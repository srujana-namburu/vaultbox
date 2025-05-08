import { users, vaultEntries, trustedContacts, sharedEntries, activityLogs } from "@shared/schema";
import type { User, InsertUser, VaultEntry, InsertVaultEntry, TrustedContact, InsertTrustedContact, SharedEntry, InsertSharedEntry, ActivityLog, InsertActivityLog } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<User | undefined>;
  updateUserSecurityScore(id: number, score: number): Promise<User | undefined>;
  
  // Vault entry operations
  getVaultEntries(userId: number): Promise<VaultEntry[]>;
  getVaultEntry(id: number): Promise<VaultEntry | undefined>;
  getVaultEntriesByCategory(userId: number, category: string): Promise<VaultEntry[]>;
  createVaultEntry(entry: InsertVaultEntry): Promise<VaultEntry>;
  updateVaultEntry(id: number, entry: Partial<VaultEntry>): Promise<VaultEntry | undefined>;
  deleteVaultEntry(id: number): Promise<boolean>;
  
  // Trusted contact operations
  getTrustedContacts(userId: number): Promise<TrustedContact[]>;
  getTrustedContact(id: number): Promise<TrustedContact | undefined>;
  createTrustedContact(contact: InsertTrustedContact): Promise<TrustedContact>;
  updateTrustedContact(id: number, contact: Partial<TrustedContact>): Promise<TrustedContact | undefined>;
  deleteTrustedContact(id: number): Promise<boolean>;
  
  // Shared entry operations
  getSharedEntries(entryId: number): Promise<SharedEntry[]>;
  createSharedEntry(shared: InsertSharedEntry): Promise<SharedEntry>;
  updateSharedEntry(id: number, shared: Partial<SharedEntry>): Promise<SharedEntry | undefined>;
  deleteSharedEntry(id: number): Promise<boolean>;
  
  // Activity log operations
  getActivityLogs(userId: number, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private vaultEntries: Map<number, VaultEntry>;
  private trustedContacts: Map<number, TrustedContact>;
  private sharedEntries: Map<number, SharedEntry>;
  private activityLogs: Map<number, ActivityLog>;
  
  private userIdCounter: number;
  private entryIdCounter: number;
  private contactIdCounter: number;
  private sharedIdCounter: number;
  private logIdCounter: number;
  
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.vaultEntries = new Map();
    this.trustedContacts = new Map();
    this.sharedEntries = new Map();
    this.activityLogs = new Map();
    
    this.userIdCounter = 1;
    this.entryIdCounter = 1;
    this.contactIdCounter = 1;
    this.sharedIdCounter = 1;
    this.logIdCounter = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const newUser: User = { ...user, id, securityScore: 50, lastLogin: now };
    this.users.set(id, newUser);
    return newUser;
  }
  
  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, lastLogin: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async updateUserSecurityScore(id: number, score: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, securityScore: score };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Vault entry operations
  async getVaultEntries(userId: number): Promise<VaultEntry[]> {
    return Array.from(this.vaultEntries.values()).filter(
      (entry) => entry.userId === userId
    );
  }
  
  async getVaultEntry(id: number): Promise<VaultEntry | undefined> {
    return this.vaultEntries.get(id);
  }
  
  async getVaultEntriesByCategory(userId: number, category: string): Promise<VaultEntry[]> {
    return Array.from(this.vaultEntries.values()).filter(
      (entry) => entry.userId === userId && entry.category === category
    );
  }
  
  async createVaultEntry(entry: InsertVaultEntry): Promise<VaultEntry> {
    const id = this.entryIdCounter++;
    const now = new Date();
    const newEntry: VaultEntry = { 
      ...entry, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.vaultEntries.set(id, newEntry);
    return newEntry;
  }
  
  async updateVaultEntry(id: number, entry: Partial<VaultEntry>): Promise<VaultEntry | undefined> {
    const existingEntry = this.vaultEntries.get(id);
    if (!existingEntry) return undefined;
    
    const updatedEntry = { 
      ...existingEntry, 
      ...entry, 
      updatedAt: new Date() 
    };
    this.vaultEntries.set(id, updatedEntry);
    return updatedEntry;
  }
  
  async deleteVaultEntry(id: number): Promise<boolean> {
    return this.vaultEntries.delete(id);
  }
  
  // Trusted contact operations
  async getTrustedContacts(userId: number): Promise<TrustedContact[]> {
    return Array.from(this.trustedContacts.values()).filter(
      (contact) => contact.userId === userId
    );
  }
  
  async getTrustedContact(id: number): Promise<TrustedContact | undefined> {
    return this.trustedContacts.get(id);
  }
  
  async createTrustedContact(contact: InsertTrustedContact): Promise<TrustedContact> {
    const id = this.contactIdCounter++;
    const newContact: TrustedContact = { ...contact, id };
    this.trustedContacts.set(id, newContact);
    return newContact;
  }
  
  async updateTrustedContact(id: number, contact: Partial<TrustedContact>): Promise<TrustedContact | undefined> {
    const existingContact = this.trustedContacts.get(id);
    if (!existingContact) return undefined;
    
    const updatedContact = { ...existingContact, ...contact };
    this.trustedContacts.set(id, updatedContact);
    return updatedContact;
  }
  
  async deleteTrustedContact(id: number): Promise<boolean> {
    return this.trustedContacts.delete(id);
  }
  
  // Shared entry operations
  async getSharedEntries(entryId: number): Promise<SharedEntry[]> {
    return Array.from(this.sharedEntries.values()).filter(
      (shared) => shared.entryId === entryId
    );
  }
  
  async createSharedEntry(shared: InsertSharedEntry): Promise<SharedEntry> {
    const id = this.sharedIdCounter++;
    const newShared: SharedEntry = { ...shared, id };
    this.sharedEntries.set(id, newShared);
    return newShared;
  }
  
  async updateSharedEntry(id: number, shared: Partial<SharedEntry>): Promise<SharedEntry | undefined> {
    const existingShared = this.sharedEntries.get(id);
    if (!existingShared) return undefined;
    
    const updatedShared = { ...existingShared, ...shared };
    this.sharedEntries.set(id, updatedShared);
    return updatedShared;
  }
  
  async deleteSharedEntry(id: number): Promise<boolean> {
    return this.sharedEntries.delete(id);
  }
  
  // Activity log operations
  async getActivityLogs(userId: number, limit = 10): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = this.logIdCounter++;
    const now = new Date();
    const newLog: ActivityLog = { ...log, id, timestamp: now };
    this.activityLogs.set(id, newLog);
    return newLog;
  }
}

export const storage = new MemStorage();
