import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertVaultEntrySchema, 
  insertTrustedContactSchema, 
  insertSharedEntrySchema,
  insertActivityLogSchema,
  insertAccessRequestSchema,
  insertNotificationSchema,
  insertUserDeviceSchema,
  trustedContacts,
  accessRequests
} from "@shared/schema";
import { eq, asc, and, desc, sql, isNotNull } from "drizzle-orm";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Error handler for zod validation errors
  const handleZodError = (err: unknown, res: Response) => {
    if (err instanceof ZodError) {
      const validationError = fromZodError(err);
      return res.status(400).json({ message: validationError.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  };

  // Vault entries routes
  app.get("/api/vault-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const entries = await storage.getVaultEntries(userId);
      res.json(entries);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch vault entries" });
    }
  });
  
  // Get category statistics
  app.get("/api/vault-entries/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const entries = await storage.getVaultEntries(userId);
      
      const categoryStats = entries.reduce((stats: Record<string, number>, entry) => {
        const category = entry.category;
        stats[category] = (stats[category] || 0) + 1;
        return stats;
      }, {});
      
      res.json(categoryStats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch category statistics" });
    }
  });

  app.get("/api/vault-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const entry = await storage.getVaultEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(entry);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch vault entry" });
    }
  });

  app.get("/api/vault-entries/category/:category", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const category = req.params.category;
      const entries = await storage.getVaultEntriesByCategory(userId, category);
      res.json(entries);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch entries by category" });
    }
  });
  
  app.get("/api/vault-entries/search", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const entries = await storage.searchVaultEntries(userId, query);
      res.json(entries);
    } catch (err) {
      res.status(500).json({ message: "Failed to search vault entries" });
    }
  });

  app.post("/api/vault-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const entryData = insertVaultEntrySchema.parse({ ...req.body, userId });
      
      const newEntry = await storage.createVaultEntry(entryData);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "entry_created",
        details: `Created "${newEntry.title}" entry`
      });
      
      res.status(201).json(newEntry);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.put("/api/vault-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const entry = await storage.getVaultEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedEntry = await storage.updateVaultEntry(entryId, req.body);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "entry_updated",
        details: `Updated "${updatedEntry!.title}" entry`
      });
      
      res.json(updatedEntry);
    } catch (err) {
      res.status(500).json({ message: "Failed to update vault entry" });
    }
  });

  app.delete("/api/vault-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const entry = await storage.getVaultEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const entryTitle = entry.title;
      const success = await storage.deleteVaultEntry(entryId);
      
      if (success) {
        // Log activity
        await storage.createActivityLog({
          userId,
          action: "entry_deleted",
          details: `Deleted "${entryTitle}" entry`
        });
        
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: "Failed to delete entry" });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to delete vault entry" });
    }
  });

  // Trusted contacts routes
  app.get("/api/trusted-contacts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contacts = await storage.getTrustedContacts(userId);
      res.json(contacts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch trusted contacts" });
    }
  });

  app.post("/api/trusted-contacts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Check if user already has a trusted contact
      const existingContacts = await storage.getTrustedContacts(userId);
      if (existingContacts.length > 0) {
        return res.status(400).json({ 
          message: "You already have a trusted contact. Only one trusted contact is allowed per account." 
        });
      }
      
      const contactData = insertTrustedContactSchema.parse({ 
        ...req.body, 
        userId,
        status: 'pending',
        accessLevel: req.body.accessLevel || 'emergency_only',
        lastInactivityResetDate: new Date()
      });
      
      const newContact = await storage.createTrustedContact(contactData);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "contact_added",
        details: `Added "${newContact.name}" as trusted contact`
      });
      
      // Create notification for the user
      await storage.createNotification({
        userId,
        title: "Trusted Contact Added",
        message: `${newContact.name} has been added as your trusted contact. They will receive an invitation email shortly.`,
        type: "contact_added",
        priority: "medium"
      });
      
      res.status(201).json(newContact);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.put("/api/trusted-contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const contact = await storage.getTrustedContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      if (contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedContact = await storage.updateTrustedContact(contactId, req.body);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "contact_updated",
        details: `Updated trusted contact "${updatedContact!.name}"`
      });
      
      res.json(updatedContact);
    } catch (err) {
      res.status(500).json({ message: "Failed to update trusted contact" });
    }
  });

  app.delete("/api/trusted-contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const contact = await storage.getTrustedContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      if (contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const contactName = contact.name;
      const success = await storage.deleteTrustedContact(contactId);
      
      if (success) {
        // Log activity
        await storage.createActivityLog({
          userId,
          action: "contact_deleted",
          details: `Removed "${contactName}" from trusted contacts`
        });
        
        // Create notification
        await storage.createNotification({
          userId,
          title: "Trusted Contact Removed",
          message: `${contactName} has been removed from your trusted contacts.`,
          type: "contact_deleted",
          priority: "medium"
        });
        
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: "Failed to delete contact" });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to delete trusted contact" });
    }
  });
  
  // Trusted contact inactivity reset route
  app.post("/api/trusted-contacts/:id/reset-inactivity", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const contact = await storage.getTrustedContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      if (contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedContact = await storage.updateTrustedContactInactivityReset(contactId);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "inactivity_timer_reset",
        details: `Reset inactivity timer for trusted contact "${contact.name}"`
      });
      
      res.json(updatedContact);
    } catch (err) {
      res.status(500).json({ message: "Failed to reset inactivity timer" });
    }
  });
  
  // Emergency access request initiation route (for trusted contacts to use)
  app.post("/api/emergency-access-request", async (req, res) => {
    try {
      const { email, targetUserEmail, reason } = req.body;
      
      if (!email || !targetUserEmail || !reason) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get the target user
      const targetUser = await storage.getUserByEmail(targetUserEmail);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify this person is a trusted contact for the target user
      const contact = await storage.getTrustedContactByEmail(targetUser.id, email);
      if (!contact) {
        return res.status(403).json({ message: "You are not a trusted contact for this user" });
      }
      
      // Create an access request
      const accessRequest = await storage.createAccessRequest({
        contactId: contact.id,
        reason,
        status: 'pending'
      });
      
      // Create a notification for the vault owner
      await storage.createNotification({
        userId: targetUser.id,
        title: "Emergency Access Request",
        message: `${contact.name} has requested emergency access to your vault. Review this request as soon as possible.`,
        type: "emergency_access_requested",
        priority: "critical"
      });
      
      // Log the activity for the target user
      await storage.createActivityLog({
        userId: targetUser.id,
        action: "emergency_access_requested",
        details: `${contact.name} requested emergency access to your vault`,
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      res.status(201).json({ 
        message: "Emergency access request created successfully",
        requestId: accessRequest.id,
        autoApproveAt: accessRequest.autoApproveAt
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to create emergency access request" });
    }
  });

  // Shared entries routes
  app.get("/api/shared-entries/:entryId", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.entryId);
      const userId = req.user!.id;
      
      const entry = await storage.getVaultEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const sharedEntries = await storage.getSharedEntries(entryId);
      res.json(sharedEntries);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch shared entries" });
    }
  });

  app.post("/api/shared-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sharedData = insertSharedEntrySchema.parse(req.body);
      
      const entry = await storage.getVaultEntry(sharedData.entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const contact = await storage.getTrustedContact(sharedData.contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      if (contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const newShared = await storage.createSharedEntry(sharedData);
      
      // Update entry status to shared
      await storage.updateVaultEntry(entry.id, { status: "shared" });
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "entry_shared",
        details: `Shared "${entry.title}" with ${contact.name}`
      });
      
      res.status(201).json(newShared);
    } catch (err) {
      handleZodError(err, res);
    }
  });

  app.delete("/api/shared-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const sharedId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Get the shared entry
      const sharedEntries = Array.from(await storage.getSharedEntries(-1)); // Workaround to get all shared entries
      const sharedEntry = sharedEntries.find(entry => entry.id === sharedId);
      
      if (!sharedEntry) {
        return res.status(404).json({ message: "Shared entry not found" });
      }
      
      // Verify ownership
      const vaultEntry = await storage.getVaultEntry(sharedEntry.entryId);
      
      if (!vaultEntry || vaultEntry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteSharedEntry(sharedId);
      
      if (success) {
        // Check if there are any remaining shares for this entry
        const remainingShares = await storage.getSharedEntries(sharedEntry.entryId);
        
        if (remainingShares.length === 0) {
          // Update entry status back to active if no shares remain
          await storage.updateVaultEntry(sharedEntry.entryId, { status: "active" });
        }
        
        // Log activity
        await storage.createActivityLog({
          userId,
          action: "entry_updated",
          details: `Removed sharing for "${vaultEntry.title}"`
        });
        
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: "Failed to delete shared entry" });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to delete shared entry" });
    }
  });

  // Activity logs route
  app.get("/api/activity-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const logs = await storage.getActivityLogs(userId, limit);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post("/api/notifications/:id/mark-read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      
      if (!updatedNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(updatedNotification);
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      await storage.markAllNotificationsAsRead(userId);
      res.status(200).json({ message: "All notifications marked as read" });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // User devices routes
  app.get("/api/user-devices", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const devices = await storage.getUserDevices(userId);
      res.json(devices);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch user devices" });
    }
  });

  app.delete("/api/user-devices/:id", isAuthenticated, async (req, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const device = await storage.getUserDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      if (device.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteUserDevice(deviceId);
      
      if (success) {
        // Log activity
        await storage.createActivityLog({
          userId,
          action: "security_settings_changed",
          details: `Removed device "${device.deviceName}"`,
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        });
        
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: "Failed to delete device" });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to delete device" });
    }
  });

  // Access requests routes
  app.get("/api/access-requests/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const requests = await storage.getPendingAccessRequests(userId);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pending access requests" });
    }
  });

  app.post("/api/access-requests/:id/respond", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { status, responseMessage } = req.body;
      
      if (!status || !['approved', 'denied'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const accessRequest = await storage.getAccessRequest(requestId);
      
      if (!accessRequest) {
        return res.status(404).json({ message: "Access request not found" });
      }
      
      // Get the contact to verify ownership
      const contact = await storage.getTrustedContact(accessRequest.contactId);
      
      if (!contact || contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedRequest = await storage.updateAccessRequest(requestId, {
        status,
        responseMessage,
        respondedAt: new Date()
      });
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: status === 'approved' ? "emergency_access_granted" : "emergency_access_denied",
        details: `${status === 'approved' ? 'Approved' : 'Denied'} emergency access request from ${contact.name}`,
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      });
      
      // Create notification
      await storage.createNotification({
        userId,
        title: `Emergency Access ${status === 'approved' ? 'Granted' : 'Denied'}`,
        message: `You have ${status === 'approved' ? 'granted' : 'denied'} emergency access to ${contact.name}.`,
        type: "emergency_access_response",
        priority: "critical"
      });
      
      res.json(updatedRequest);
    } catch (err) {
      res.status(500).json({ message: "Failed to respond to access request" });
    }
  });

  // Check inactivity status for emergency access - used by background process
  app.get("/api/trusted-contacts/check-inactivity", async (req, res) => {
    try {
      const authToken = req.headers.authorization?.split(' ')[1];
      
      // Very simple auth check for system processes
      // In production, this would use a proper API key system
      if (authToken !== process.env.SYSTEM_API_KEY) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get all trusted contacts
      const db = storage.db;
      const contacts = await db
        .select()
        .from(trustedContacts)
        .where(
          and(
            eq(trustedContacts.status, 'active'),
            isNotNull(trustedContacts.lastInactivityResetDate)
          )
        );
      
      const now = new Date();
      const processedContacts = [];
      
      // Process each contact for inactivity
      for (const contact of contacts) {
        if (!contact.lastInactivityResetDate || !contact.waitingPeriod) continue;
        
        // Parse waiting period (assuming format like "30 days" or "24 hours")
        let waitingHours = 24; // Default to 24 hours
        const waitingPeriod = contact.waitingPeriod;
        const match = waitingPeriod.match(/(\d+)\s*(hour|hours|day|days)/i);
        
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          
          if (unit === 'hour' || unit === 'hours') {
            waitingHours = value;
          } else if (unit === 'day' || unit === 'days') {
            waitingHours = value * 24;
          }
        }
        
        // Calculate inactivity threshold
        const lastReset = new Date(contact.lastInactivityResetDate);
        const thresholdMs = waitingHours * 60 * 60 * 1000;
        const hasExceededThreshold = (now.getTime() - lastReset.getTime()) > thresholdMs;
        
        if (hasExceededThreshold) {
          // User is considered inactive, create automatic emergency access
          const accessRequest = await storage.createAccessRequest({
            contactId: contact.id,
            reason: "Automated emergency access due to user inactivity",
            status: 'pending'
          });
          
          // Create notification for the user
          await storage.createNotification({
            userId: contact.userId,
            title: "Emergency Access Triggered",
            message: `Due to inactivity, an emergency access request has been automatically created for ${contact.name}. They will gain access after the waiting period.`,
            type: "emergency_access_triggered",
            priority: "critical"
          });
          
          // Log the activity
          await storage.createActivityLog({
            userId: contact.userId,
            action: "emergency_access_triggered",
            details: `Automatic emergency access triggered due to inactivity for ${contact.name}`
          });
          
          processedContacts.push({
            contactId: contact.id,
            contactName: contact.name,
            userId: contact.userId,
            accessRequestId: accessRequest.id,
            autoApproveAt: accessRequest.autoApproveAt
          });
        }
      }
      
      res.json({
        processedCount: processedContacts.length,
        processedContacts
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to check inactivity status" });
    }
  });
  
  // Database status check endpoint
  app.get("/api/health/db", async (req, res) => {
    try {
      // Try a simple query to check if the database is working
      const user = await storage.getUserByUsername("test-user-that-doesnt-exist");
      res.json({ status: "ok", message: "Database connection is working properly" });
    } catch (err) {
      res.status(500).json({ 
        status: "error", 
        message: "Database connection failed", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
