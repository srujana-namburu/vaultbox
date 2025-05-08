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
  insertNotificationPreferencesSchema,
  trustedContacts,
  accessRequests
} from "@shared/schema";
import { eq, asc, and, desc, sql, isNotNull } from "drizzle-orm";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { webSocketService } from "./services/websocket";
import { notificationService } from "./services/notification";
import crypto from "crypto";
import { sendNotificationEmail } from "./services/email";

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
  
  // Entry version routes
  app.get("/api/vault-entries/:id/versions", isAuthenticated, async (req, res) => {
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
      
      const versions = await storage.getEntryVersions(entryId);
      res.json(versions);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch entry versions" });
    }
  });
  
  app.get("/api/entry-versions/:id", isAuthenticated, async (req, res) => {
    try {
      const versionId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const version = await storage.getEntryVersion(versionId);
      
      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }
      
      // Check if the user owns the entry this version belongs to
      const entry = await storage.getVaultEntry(version.entryId);
      
      if (!entry || entry.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(version);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch entry version" });
    }
  });

  // Trusted accounts (where user is a trusted contact) route
  app.get("/api/trusted-accounts/as-contact", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const email = req.user!.email;
      
      // Find all contacts where this user's email matches with joined user data
      const contacts = await storage.db
        .select({
          contactId: trustedContacts.id,
          userId: trustedContacts.userId,
          status: trustedContacts.status,
          accessLevel: trustedContacts.accessLevel,
          inactivityPeriod: trustedContacts.inactivityPeriod,
          lastInactivityResetDate: trustedContacts.lastInactivityResetDate,
          ownerName: storage.db.users.fullName,
          ownerEmail: storage.db.users.email
        })
        .from(trustedContacts)
        .innerJoin(storage.db.users, eq(trustedContacts.userId, storage.db.users.id))
        .where(eq(trustedContacts.email, email));

      // Map the results to the expected format
      const accounts = contacts.map(contact => ({
        id: contact.contactId,
        ownerName: contact.ownerName,
        ownerEmail: contact.ownerEmail,
        status: contact.status,
        accessLevel: contact.accessLevel,
        inactivityThreshold: contact.inactivityPeriod,
        daysSinceLastActivity: Math.floor(
          (Date.now() - new Date(contact.lastInactivityResetDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        )
      }));
      
      res.json(accounts);
    } catch (err) {
      console.error("Error fetching trusted accounts:", err);
      res.status(500).json({ message: "Failed to fetch trusted accounts" });
    }
  });

  // Trusted contacts routes  
  app.get("/api/trusted-contacts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Get contacts specifically for this user
      const contacts = await storage.getTrustedContacts(userId);
      
      // Additional verification that all returned contacts belong to this user
      const userContacts = contacts.filter(contact => contact.userId === userId);
      
      res.json(userContacts);
    } catch (err) {
      console.error("Trusted contacts error:", err);
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
      // Generate a unique verification code
      const verificationCode = crypto.randomBytes(32).toString("hex");
      const contactData = insertTrustedContactSchema.parse({ 
        ...req.body, 
        userId,
        status: 'pending',
        accessLevel: req.body.accessLevel || 'emergency_only',
        lastInactivityResetDate: new Date(),
        verificationCode,
        invitationSentAt: new Date()
      });
      const newContact = await storage.createTrustedContact(contactData);
      // Send confirmation email
      const confirmUrl = `${process.env.BASE_URL || "http://localhost:3000"}/api/trusted-contacts/verify?code=${verificationCode}`;
      await sendNotificationEmail(
        newContact.email,
        "Confirm your Trusted Contact Invitation",
        `Hello ${newContact.name},\n\nYou have been invited as a trusted contact. Please confirm your invitation by clicking the button below.`,
        confirmUrl,
        "Confirm Invitation"
      );
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "contact_added",
        details: `Added \"${newContact.name}\" as trusted contact`
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

  // Trusted contact verification endpoint
  app.get("/api/trusted-contacts/verify", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== "string") {
        return res.status(400).send("Invalid verification code.");
      }
      // Find the contact with this code
      const db = storage.db;
      const [contact] = await db.select().from(trustedContacts).where(eq(trustedContacts.verificationCode, code));
      if (!contact) {
        return res.status(404).send("Verification code not found or already used.");
      }
      // Mark as active and set verifiedAt
      await storage.updateTrustedContact(contact.id, {
        status: "active",
        verifiedAt: new Date(),
        verificationCode: null
      });
      // Optionally, redirect to a confirmation page or send a message
      res.send("Your invitation has been confirmed. You are now a trusted contact.");
    } catch (err) {
      res.status(500).send("Failed to verify trusted contact.");
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
      
      // Check if there's an existing pending request
      const existingRequests = await storage.getAccessRequests(contact.id);
      const pendingRequest = existingRequests.find(req => req.status === 'pending');
      
      if (pendingRequest) {
        return res.status(400).json({ 
          message: "You already have a pending emergency access request",
          requestId: pendingRequest.id,
          autoApproveAt: pendingRequest.autoApproveAt
        });
      }
      
      // Calculate auto-approve date (48 hours from now by default)
      const autoApproveAt = new Date();
      autoApproveAt.setHours(autoApproveAt.getHours() + 48);
      
      // Create an access request
      const accessRequest = await storage.createAccessRequest({
        contactId: contact.id,
        reason,
        status: 'pending',
        requestedAt: new Date(),
        autoApproveAt
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
      console.error("Emergency access request error:", err);
      res.status(500).json({ message: "Failed to create emergency access request" });
    }
  });
  
  // Get pending access requests for a user
  app.get("/api/emergency-requests/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const pendingRequests = await storage.getPendingAccessRequests(userId);
      res.json(pendingRequests);
    } catch (err) {
      console.error("Pending emergency requests error:", err);
      res.status(500).json({ message: "Failed to fetch pending access requests" });
    }
  });
  
  // Get specific emergency request
  app.get("/api/emergency-requests/:id", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const accessRequest = await storage.getAccessRequest(requestId);
      
      if (!accessRequest) {
        return res.status(404).json({ message: "Access request not found" });
      }
      
      res.json(accessRequest);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch access request" });
    }
  });
  
  // Approve emergency access request
  app.put("/api/emergency-requests/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { note } = req.body;
      
      // Get the request
      const request = await storage.getAccessRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Access request not found" });
      }
      
      // Get the associated contact to verify ownership
      const contact = await storage.getTrustedContact(request.contactId);
      
      if (!contact || contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Calculate access expiration (24 hours from now)
      const accessExpiresAt = new Date();
      accessExpiresAt.setHours(accessExpiresAt.getHours() + 24);
      
      // Generate a secure access token
      const accessToken = crypto.randomBytes(32).toString('hex');
      
      // Update the request
      const updatedRequest = await storage.updateAccessRequest(requestId, {
        status: 'approved',
        responseNote: note,
        accessToken,
        accessExpiresAt
      });
      
      // Log the activity
      await storage.createActivityLog({
        userId,
        action: "emergency_access_approved",
        details: `Approved emergency access for ${contact.name}`,
        ipAddress: req.ip
      });
      
      // Create a notification for the contact
      await storage.createNotification({
        userId,
        title: "Emergency Access Approved",
        message: `You approved emergency access for ${contact.name}`,
        type: "emergency_access_approved",
        priority: "high"
      });
      
      res.json(updatedRequest);
    } catch (err) {
      console.error("Approve emergency request error:", err);
      res.status(500).json({ message: "Failed to approve access request" });
    }
  });
  
  // Deny emergency access request
  app.put("/api/emergency-requests/:id/deny", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { note } = req.body;
      
      // Get the request
      const request = await storage.getAccessRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Access request not found" });
      }
      
      // Get the associated contact to verify ownership
      const contact = await storage.getTrustedContact(request.contactId);
      
      if (!contact || contact.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update the request
      const updatedRequest = await storage.updateAccessRequest(requestId, {
        status: 'denied',
        responseNote: note
      });
      
      // Log the activity
      await storage.createActivityLog({
        userId,
        action: "emergency_access_denied",
        details: `Denied emergency access for ${contact.name}`,
        ipAddress: req.ip
      });
      
      // Create a notification for the user
      await storage.createNotification({
        userId,
        title: "Emergency Access Denied",
        message: `You denied emergency access for ${contact.name}`,
        type: "emergency_access_denied",
        priority: "medium"
      });
      
      res.json(updatedRequest);
    } catch (err) {
      console.error("Deny emergency request error:", err);
      res.status(500).json({ message: "Failed to deny access request" });
    }
  });
  
  // Verify emergency access token
  app.post("/api/emergency-access/verify", async (req, res) => {
    try {
      const { token, requestId, contactId } = req.body;
      
      if (!token || !requestId || !contactId) {
        return res.status(400).json({ valid: false, message: "Missing required parameters" });
      }
      
      // Get the request
      const request = await storage.getAccessRequest(parseInt(requestId));
      
      if (!request) {
        return res.status(404).json({ valid: false, message: "Access request not found" });
      }
      
      // Verify the token and request status
      if (request.contactId !== parseInt(contactId)) {
        return res.status(403).json({ valid: false, message: "Invalid access token" });
      }
      
      if (request.accessToken !== token) {
        return res.status(403).json({ valid: false, message: "Invalid access token" });
      }
      
      if (request.status !== 'approved') {
        return res.status(403).json({ valid: false, message: "Access request has not been approved" });
      }
      
      // Check if access has expired
      if (request.accessExpiresAt && new Date(request.accessExpiresAt) < new Date()) {
        return res.status(403).json({ valid: false, message: "Access has expired" });
      }
      
      // Get the contact for logging
      const contact = await storage.getTrustedContact(request.contactId);
      
      // Log the access
      if (contact) {
        await storage.createActivityLog({
          userId: contact.userId,
          action: "emergency_access_used",
          details: `${contact.name} accessed the vault using emergency access`,
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        });
      }
      
      res.json({ valid: true });
    } catch (err) {
      console.error("Verify emergency access error:", err);
      res.status(500).json({ valid: false, message: "Failed to verify access" });
    }
  });
  
  // Get emergency accessible vault entries
  app.get("/api/emergency-access/:requestId", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      // Get the request
      const request = await storage.getAccessRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Access request not found" });
      }
      
      // Verify the request status
      if (request.status !== 'approved') {
        return res.status(403).json({ message: "Access request has not been approved" });
      }
      
      // Check if access has expired
      if (request.accessExpiresAt && new Date(request.accessExpiresAt) < new Date()) {
        return res.status(403).json({ message: "Access has expired" });
      }
      
      // Get the contact
      const contact = await storage.getTrustedContact(request.contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Get shared entries for this contact
      const sharedEntries = await storage.getSharedEntriesByContact(contact.id);
      
      if (!sharedEntries || sharedEntries.length === 0) {
        return res.json([]);
      }
      
      // Get the actual vault entries
      const entryIds = sharedEntries.map(se => se.entryId);
      const entries = [];
      
      for (const entryId of entryIds) {
        const entry = await storage.getVaultEntry(entryId);
        if (entry) {
          entries.push(entry);
        }
      }
      
      // Log this access
      await storage.createActivityLog({
        userId: contact.userId,
        action: "emergency_access_used",
        details: `${contact.name} viewed emergency accessible vault entries`,
        ipAddress: req.ip
      });
      
      res.json(entries);
    } catch (err) {
      console.error("Emergency access entries error:", err);
      res.status(500).json({ message: "Failed to fetch emergency accessible entries" });
    }
  });
  
  // Download an emergency accessible entry
  app.get("/api/emergency-access/download/:entryId", async (req, res) => {
    try {
      const entryId = parseInt(req.params.entryId);
      const { requestId, contactId } = req.query;
      
      if (!requestId || !contactId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Get the request
      const request = await storage.getAccessRequest(parseInt(requestId as string));
      
      if (!request) {
        return res.status(404).json({ message: "Access request not found" });
      }
      
      // Verify the request
      if (request.contactId !== parseInt(contactId as string) || request.status !== 'approved') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get the entry
      const entry = await storage.getVaultEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      // Get the contact
      const contact = await storage.getTrustedContact(request.contactId);
      
      // Log the download
      if (contact) {
        await storage.createActivityLog({
          userId: contact.userId,
          action: "emergency_access_download",
          details: `${contact.name} downloaded "${entry.title}" using emergency access`,
          ipAddress: req.ip
        });
      }
      
      // Return the entry in a downloadable format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${entry.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json"`);
      res.json(entry);
    } catch (err) {
      console.error("Emergency access download error:", err);
      res.status(500).json({ message: "Failed to download entry" });
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
  
  // Notification preferences routes
  app.get("/api/notification-preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const preferences = await storage.getNotificationPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if none exist
        const defaultPreferences = await storage.createNotificationPreferences({
          userId,
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          emailFrequency: 'immediate',
          securityAlertsEnabled: true,
          activityAlertsEnabled: true,
          updatesEnabled: true,
          emailVerified: false
        });
        return res.json(defaultPreferences);
      }
      
      res.json(preferences);
    } catch (err) {
      console.error("Notification preferences error:", err);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });
  
  app.put("/api/notification-preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const preferences = await storage.getNotificationPreferences(userId);
      
      if (!preferences) {
        // Create preferences if they don't exist
        const newPreferences = await storage.createNotificationPreferences({
          ...req.body,
          userId
        });
        return res.status(201).json(newPreferences);
      }
      
      // Update existing preferences
      const updatedPreferences = await storage.updateNotificationPreferences(userId, req.body);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "security_settings_changed",
        details: "Updated notification preferences",
        metadata: { 
          emailEnabled: updatedPreferences?.emailEnabled,
          pushEnabled: updatedPreferences?.pushEnabled,
          inAppEnabled: updatedPreferences?.inAppEnabled,
          emailFrequency: updatedPreferences?.emailFrequency
        }
      });
      
      res.json(updatedPreferences);
    } catch (err) {
      console.error("Notification preferences update error:", err);
      res.status(500).json({ message: "Failed to update notification preferences" });
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
  
  // Activity Logs endpoint
  app.get("/api/activity-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const activityLogs = await storage.getActivityLogs(userId);
      res.json(activityLogs);
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      res.status(500).json({ message: "Failed to fetch activity logs" });
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

  // Test email route
  app.post("/api/test-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const success = await sendNotificationEmail(
        email,
        "Test Email from VaultBox",
        "This is a test email to verify that the email service is working correctly.",
        "https://vaultbox.app",
        "Visit VaultBox"
      );

      if (success) {
        res.json({ message: "Test email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send test email" });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Error sending test email" });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket service
  webSocketService.initialize(httpServer);
  
  // Clean up expired notifications daily
  if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
      await notificationService.deleteExpiredNotifications();
    }, 86400000); // 24 hours
  }
  
  return httpServer;
}
