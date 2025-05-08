import { 
  users, 
  vaultEntries, 
  trustedContacts, 
  sharedEntries, 
  activityLogs,
  notifications,
  accessRequests,
  attachments,
  entryVersions,
  userDevices
} from "@shared/schema";

import type { 
  User, 
  InsertUser, 
  VaultEntry, 
  InsertVaultEntry, 
  TrustedContact, 
  InsertTrustedContact, 
  SharedEntry, 
  InsertSharedEntry, 
  ActivityLog, 
  InsertActivityLog,
  AccessRequest,
  InsertAccessRequest,
  Notification,
  InsertNotification,
  Attachment,
  InsertAttachment,
  EntryVersion,
  InsertEntryVersion,
  UserDevice,
  InsertUserDevice
} from "@shared/schema";

import { eq, desc, and, asc, or, sql } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Configure PostgreSQL session store
const PostgresSessionStore = connectPg(session);

// Define session store type
type SessionStore = ReturnType<typeof PostgresSessionStore>;

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<User | undefined>;
  updateUserSecurityScore(id: number, score: number): Promise<User | undefined>;
  updateUserFailedLoginAttempts(id: number, attempts: number): Promise<User | undefined>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  
  // User devices operations
  getUserDevices(userId: number): Promise<UserDevice[]>;
  getUserDevice(id: number): Promise<UserDevice | undefined>;
  getUserDeviceByDeviceId(userId: number, deviceId: string): Promise<UserDevice | undefined>;
  createUserDevice(device: InsertUserDevice): Promise<UserDevice>;
  updateUserDevice(id: number, device: Partial<UserDevice>): Promise<UserDevice | undefined>;
  deleteUserDevice(id: number): Promise<boolean>;
  
  // Vault entry operations
  getVaultEntries(userId: number): Promise<VaultEntry[]>;
  getVaultEntry(id: number): Promise<VaultEntry | undefined>;
  getVaultEntriesByCategory(userId: number, category: string): Promise<VaultEntry[]>;
  searchVaultEntries(userId: number, query: string): Promise<VaultEntry[]>;
  createVaultEntry(entry: InsertVaultEntry): Promise<VaultEntry>;
  updateVaultEntry(id: number, entry: Partial<VaultEntry>): Promise<VaultEntry | undefined>;
  deleteVaultEntry(id: number): Promise<boolean>;
  
  // Entry version operations
  getEntryVersions(entryId: number): Promise<EntryVersion[]>;
  getEntryVersion(id: number): Promise<EntryVersion | undefined>;
  createEntryVersion(version: InsertEntryVersion): Promise<EntryVersion>;
  
  // Attachment operations
  getAttachments(entryId: number): Promise<Attachment[]>;
  getAttachment(id: number): Promise<Attachment | undefined>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<boolean>;
  
  // Trusted contact operations
  getTrustedContacts(userId: number): Promise<TrustedContact[]>;
  getTrustedContact(id: number): Promise<TrustedContact | undefined>;
  getTrustedContactByEmail(userId: number, email: string): Promise<TrustedContact | undefined>;
  getTrustedContactByUserId(userId: number): Promise<TrustedContact | undefined>;
  updateTrustedContactInactivityReset(id: number): Promise<TrustedContact | undefined>;
  createTrustedContact(contact: InsertTrustedContact): Promise<TrustedContact>;
  updateTrustedContact(id: number, contact: Partial<TrustedContact>): Promise<TrustedContact | undefined>;
  deleteTrustedContact(id: number): Promise<boolean>;
  
  // Shared entry operations
  getSharedEntries(entryId: number): Promise<SharedEntry[]>;
  getSharedEntriesByContact(contactId: number): Promise<SharedEntry[]>;
  getSharedEntry(id: number): Promise<SharedEntry | undefined>;
  createSharedEntry(shared: InsertSharedEntry): Promise<SharedEntry>;
  updateSharedEntry(id: number, shared: Partial<SharedEntry>): Promise<SharedEntry | undefined>;
  deleteSharedEntry(id: number): Promise<boolean>;
  
  // Access request operations
  getAccessRequests(contactId: number): Promise<AccessRequest[]>;
  getPendingAccessRequests(userId: number): Promise<AccessRequest[]>;
  getAccessRequest(id: number): Promise<AccessRequest | undefined>;
  createAccessRequest(request: Partial<AccessRequest>): Promise<AccessRequest>;
  updateAccessRequest(id: number, request: Partial<AccessRequest>): Promise<AccessRequest | undefined>;
  deleteAccessRequest(id: number): Promise<boolean>;
  
  // Notification operations
  getNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  deleteNotification(id: number): Promise<boolean>;
  
  // Activity log operations
  getActivityLogs(userId: number, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  // Database access
  db: any;
  
  sessionStore: any; // Using any to resolve type issues
}

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Using any to resolve type issues
  db = db; // Expose db for direct schema operations
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async updateUserSecurityScore(id: number, score: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ securityScore: score })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async updateUserFailedLoginAttempts(id: number, attempts: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        lastFailedLogin: attempts > 0 ? new Date() : null
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  // User devices operations
  async getUserDevices(userId: number): Promise<UserDevice[]> {
    return db.select().from(userDevices).where(eq(userDevices.userId, userId));
  }
  
  async getUserDevice(id: number): Promise<UserDevice | undefined> {
    const [device] = await db.select().from(userDevices).where(eq(userDevices.id, id));
    return device;
  }
  
  async getUserDeviceByDeviceId(userId: number, deviceId: string): Promise<UserDevice | undefined> {
    const [device] = await db.select().from(userDevices).where(
      and(
        eq(userDevices.userId, userId),
        eq(userDevices.deviceId, deviceId)
      )
    );
    return device;
  }
  
  async createUserDevice(device: InsertUserDevice): Promise<UserDevice> {
    const [newDevice] = await db.insert(userDevices).values(device).returning();
    return newDevice;
  }
  
  async updateUserDevice(id: number, device: Partial<UserDevice>): Promise<UserDevice | undefined> {
    const [updatedDevice] = await db
      .update(userDevices)
      .set({
        ...device,
        lastUsed: new Date()
      })
      .where(eq(userDevices.id, id))
      .returning();
    return updatedDevice;
  }
  
  async deleteUserDevice(id: number): Promise<boolean> {
    await db.delete(userDevices).where(eq(userDevices.id, id));
    return true;
  }
  
  // Vault entry operations
  async getVaultEntries(userId: number): Promise<VaultEntry[]> {
    return db
      .select()
      .from(vaultEntries)
      .where(eq(vaultEntries.userId, userId))
      .orderBy(desc(vaultEntries.updatedAt));
  }
  
  async getVaultEntry(id: number): Promise<VaultEntry | undefined> {
    const [entry] = await db.select().from(vaultEntries).where(eq(vaultEntries.id, id));
    return entry;
  }
  
  async getVaultEntriesByCategory(userId: number, category: string): Promise<VaultEntry[]> {
    return db
      .select()
      .from(vaultEntries)
      .where(
        and(
          eq(vaultEntries.userId, userId),
          sql`${vaultEntries.category} = ${category}` // Using SQL template for safe comparison
        )
      )
      .orderBy(desc(vaultEntries.updatedAt));
  }
  
  async searchVaultEntries(userId: number, query: string): Promise<VaultEntry[]> {
    const searchTerm = `%${query}%`;
    return db
      .select()
      .from(vaultEntries)
      .where(
        and(
          eq(vaultEntries.userId, userId),
          or(
            sql`${vaultEntries.title} ILIKE ${searchTerm}`,
            sql`${vaultEntries.category} ILIKE ${searchTerm}`
          )
        )
      )
      .orderBy(desc(vaultEntries.updatedAt));
  }
  
  async createVaultEntry(entry: InsertVaultEntry): Promise<VaultEntry> {
    const [newEntry] = await db
      .insert(vaultEntries)
      .values({
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newEntry;
  }
  
  async updateVaultEntry(id: number, entry: Partial<VaultEntry>): Promise<VaultEntry | undefined> {
    const [updatedEntry] = await db
      .update(vaultEntries)
      .set({
        ...entry,
        updatedAt: new Date()
      })
      .where(eq(vaultEntries.id, id))
      .returning();
    return updatedEntry;
  }
  
  async deleteVaultEntry(id: number): Promise<boolean> {
    await db.delete(vaultEntries).where(eq(vaultEntries.id, id));
    return true;
  }
  
  // Entry version operations
  async getEntryVersions(entryId: number): Promise<EntryVersion[]> {
    return db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.entryId, entryId))
      .orderBy(desc(entryVersions.versionNumber));
  }
  
  async getEntryVersion(id: number): Promise<EntryVersion | undefined> {
    const [version] = await db.select().from(entryVersions).where(eq(entryVersions.id, id));
    return version;
  }
  
  async createEntryVersion(version: InsertEntryVersion): Promise<EntryVersion> {
    const [newVersion] = await db.insert(entryVersions).values(version).returning();
    return newVersion;
  }
  
  // Attachment operations
  async getAttachments(entryId: number): Promise<Attachment[]> {
    return db.select().from(attachments).where(eq(attachments.entryId, entryId));
  }
  
  async getAttachment(id: number): Promise<Attachment | undefined> {
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id));
    return attachment;
  }
  
  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db.insert(attachments).values(attachment).returning();
    return newAttachment;
  }
  
  async deleteAttachment(id: number): Promise<boolean> {
    await db.delete(attachments).where(eq(attachments.id, id));
    return true;
  }
  
  // Trusted contact operations
  async getTrustedContacts(userId: number): Promise<TrustedContact[]> {
    return db.select().from(trustedContacts).where(eq(trustedContacts.userId, userId));
  }
  
  async getTrustedContact(id: number): Promise<TrustedContact | undefined> {
    const [contact] = await db.select().from(trustedContacts).where(eq(trustedContacts.id, id));
    return contact;
  }
  
  async getTrustedContactByEmail(userId: number, email: string): Promise<TrustedContact | undefined> {
    const [contact] = await db
      .select()
      .from(trustedContacts)
      .where(
        and(
          eq(trustedContacts.userId, userId),
          eq(trustedContacts.email, email)
        )
      );
    return contact;
  }
  
  async getTrustedContactByUserId(userId: number): Promise<TrustedContact | undefined> {
    const [contact] = await db
      .select()
      .from(trustedContacts)
      .where(eq(trustedContacts.userId, userId));
    return contact;
  }
  
  async updateTrustedContactInactivityReset(id: number): Promise<TrustedContact | undefined> {
    const [updatedContact] = await db
      .update(trustedContacts)
      .set({ 
        lastInactivityResetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(trustedContacts.id, id))
      .returning();
    return updatedContact;
  }
  
  async createTrustedContact(contact: InsertTrustedContact): Promise<TrustedContact> {
    const now = new Date();
    const [newContact] = await db
      .insert(trustedContacts)
      .values({
        ...contact,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return newContact;
  }
  
  async updateTrustedContact(id: number, contact: Partial<TrustedContact>): Promise<TrustedContact | undefined> {
    const [updatedContact] = await db
      .update(trustedContacts)
      .set({
        ...contact,
        updatedAt: new Date()
      })
      .where(eq(trustedContacts.id, id))
      .returning();
    return updatedContact;
  }
  
  async deleteTrustedContact(id: number): Promise<boolean> {
    await db.delete(trustedContacts).where(eq(trustedContacts.id, id));
    return true;
  }
  
  // Shared entry operations
  async getSharedEntries(entryId: number): Promise<SharedEntry[]> {
    return db.select().from(sharedEntries).where(eq(sharedEntries.entryId, entryId));
  }
  
  async getSharedEntriesByContact(contactId: number): Promise<SharedEntry[]> {
    return db.select().from(sharedEntries).where(eq(sharedEntries.contactId, contactId));
  }
  
  async getSharedEntry(id: number): Promise<SharedEntry | undefined> {
    const [shared] = await db.select().from(sharedEntries).where(eq(sharedEntries.id, id));
    return shared;
  }
  
  async createSharedEntry(shared: InsertSharedEntry): Promise<SharedEntry> {
    const now = new Date();
    const [newShared] = await db
      .insert(sharedEntries)
      .values({
        ...shared,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return newShared;
  }
  
  async updateSharedEntry(id: number, shared: Partial<SharedEntry>): Promise<SharedEntry | undefined> {
    const [updatedShared] = await db
      .update(sharedEntries)
      .set({
        ...shared,
        updatedAt: new Date()
      })
      .where(eq(sharedEntries.id, id))
      .returning();
    return updatedShared;
  }
  
  async deleteSharedEntry(id: number): Promise<boolean> {
    await db.delete(sharedEntries).where(eq(sharedEntries.id, id));
    return true;
  }
  
  // Access request operations
  async getAccessRequests(contactId: number): Promise<AccessRequest[]> {
    return db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.contactId, contactId))
      .orderBy(desc(accessRequests.requestedAt));
  }
  
  async getPendingAccessRequests(userId: number): Promise<AccessRequest[]> {
    // Get all contacts that belong to the user
    const userContacts = await this.getTrustedContacts(userId);
    const contactIds = userContacts.map(contact => contact.id);
    
    if (contactIds.length === 0) {
      return [];
    }
    
    // Get pending access requests for those contacts
    return db
      .select()
      .from(accessRequests)
      .where(
        and(
          sql`${accessRequests.contactId} = ANY(ARRAY[${contactIds.join(',')}])`,
          eq(accessRequests.status, 'pending')
        )
      )
      .orderBy(asc(accessRequests.autoApproveAt));
  }
  
  async getAccessRequest(id: number): Promise<AccessRequest | undefined> {
    const [request] = await db.select().from(accessRequests).where(eq(accessRequests.id, id));
    return request;
  }
  
  async createAccessRequest(request: Partial<AccessRequest>): Promise<AccessRequest> {
    // Calculate when this request should automatically approve based on the contact's waiting period
    const contact = await this.getTrustedContact(request.contactId!);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    // Default to 24 hours if waiting period format is not parseable
    let waitingHours = 24;
    const waitingPeriod = contact.waitingPeriod || '24 hours';
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
    
    const now = new Date();
    const autoApproveDate = new Date(now);
    autoApproveDate.setHours(autoApproveDate.getHours() + waitingHours);
    
    // Set expiration to 7 days after request
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    const [newRequest] = await db
      .insert(accessRequests)
      .values({
        contactId: request.contactId!,
        reason: request.reason || 'Emergency access request',
        status: 'pending',
        requestedAt: now,
        autoApproveAt: autoApproveDate,
        expiresAt: expiryDate,
        ipAddress: request.ipAddress,
        deviceInfo: request.deviceInfo,
        urgencyLevel: request.urgencyLevel || 'medium'
      })
      .returning();
    
    return newRequest;
  }
  
  async updateAccessRequest(id: number, request: Partial<AccessRequest>): Promise<AccessRequest | undefined> {
    const [updatedRequest] = await db
      .update(accessRequests)
      .set({
        ...request,
        respondedAt: request.status !== 'pending' ? new Date() : undefined
      })
      .where(eq(accessRequests.id, id))
      .returning();
    return updatedRequest;
  }
  
  async deleteAccessRequest(id: number): Promise<boolean> {
    await db.delete(accessRequests).where(eq(accessRequests.id, id));
    return true;
  }
  
  // Notification operations
  async getNotifications(userId: number, limit = 20): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }
  
  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    return result[0]?.count || 0;
  }
  
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values({
        ...notification,
        createdAt: new Date()
      })
      .returning();
    return newNotification;
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [updatedNotification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    await db.delete(notifications).where(eq(notifications.id, id));
    return true;
  }
  
  // Activity log operations
  async getActivityLogs(userId: number, limit = 20): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }
  
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db
      .insert(activityLogs)
      .values({
        ...log,
        timestamp: new Date()
      })
      .returning();
    return newLog;
  }
}

export const storage = new DatabaseStorage();
