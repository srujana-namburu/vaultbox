import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertVaultEntrySchema, insertTrustedContactSchema, insertSharedEntrySchema } from "@shared/schema";
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
      const contactData = insertTrustedContactSchema.parse({ ...req.body, userId });
      
      const newContact = await storage.createTrustedContact(contactData);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "contact_added",
        details: `Added "${newContact.name}" as trusted contact`
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
        
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: "Failed to delete contact" });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to delete trusted contact" });
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
          action: "sharing_removed",
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

  const httpServer = createServer(app);
  return httpServer;
}
