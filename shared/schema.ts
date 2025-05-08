import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums for more type safety
export const userStatusEnum = pgEnum('user_status', ['active', 'locked', 'suspended', 'unverified']);
export const vaultEntryStatusEnum = pgEnum('vault_entry_status', ['active', 'locked', 'shared', 'expiring']);
export const contactStatusEnum = pgEnum('contact_status', ['pending', 'active', 'declined', 'revoked']);
export const accessLevelEnum = pgEnum('access_level', ['emergency_only', 'full_access', 'limited_access', 'temporary_access']);
export const categoryEnum = pgEnum('category', [
  'personal_documents', 
  'financial_records', 
  'account_credentials', 
  'medical_information', 
  'other'
]);
export const activityTypeEnum = pgEnum('activity_type', [
  'entry_created', 
  'entry_updated', 
  'entry_shared', 
  'entry_deleted',
  'contact_added',
  'contact_updated', 
  'contact_deleted',
  'login',
  'logout',
  'account_created',
  'security_alert',
  'access_timeout',
  'document_upload',
  'security_settings_changed'
]);
export const notificationPriorityEnum = pgEnum('notification_priority', ['critical', 'high', 'medium', 'low']);

// Users table with enhanced security features
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  securityScore: integer("security_score").default(50),
  status: userStatusEnum("status").default('active'),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  recoveryKeys: jsonb("recovery_keys"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  passwordUpdatedAt: timestamp("password_updated_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  preferences: jsonb("preferences").default({}),
  createdAt: timestamp("created_at").defaultNow()
});

export const userRelations = relations(users, ({ many }) => ({
  vaultEntries: many(vaultEntries),
  trustedContacts: many(trustedContacts),
  activityLogs: many(activityLogs),
  devices: many(userDevices),
  notifications: many(notifications)
}));

// Device tracking for enhanced security
export const userDevices = pgTable("user_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceName: text("device_name").notNull(),
  deviceId: text("device_id").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  lastUsed: timestamp("last_used").defaultNow(),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow()
});

export const userDeviceRelations = relations(userDevices, ({ one }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id]
  })
}));

// Vault entries with comprehensive metadata
export const vaultEntries = pgTable("vault_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  category: categoryEnum("category").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array(),
  status: vaultEntryStatusEnum("status").default('active'),
  autoDeleteAt: timestamp("auto_delete_at"),
  allowEmergencyAccess: boolean("allow_emergency_access").default(false),
  versionNumber: integer("version_number").default(1),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const vaultEntryRelations = relations(vaultEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [vaultEntries.userId],
    references: [users.id]
  }),
  sharedEntries: many(sharedEntries),
  attachments: many(attachments),
  entryVersions: many(entryVersions)
}));

// Track version history for entries
export const entryVersions = pgTable("entry_versions", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => vaultEntries.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  changedBy: integer("changed_by").notNull().references(() => users.id),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").defaultNow()
});

export const entryVersionRelations = relations(entryVersions, ({ one }) => ({
  entry: one(vaultEntries, {
    fields: [entryVersions.entryId],
    references: [vaultEntries.id]
  }),
  user: one(users, {
    fields: [entryVersions.changedBy],
    references: [users.id]
  })
}));

// File attachments for entries
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => vaultEntries.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const attachmentRelations = relations(attachments, ({ one }) => ({
  entry: one(vaultEntries, {
    fields: [attachments.entryId],
    references: [vaultEntries.id]
  })
}));

// Trusted contacts with comprehensive management
export const trustedContacts = pgTable("trusted_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: contactStatusEnum("status").default('pending'),
  accessLevel: accessLevelEnum("access_level").notNull(),
  waitingPeriod: text("waiting_period").default("24 hours"),
  notificationPreferences: jsonb("notification_preferences").default({}),
  verificationCode: text("verification_code"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const trustedContactRelations = relations(trustedContacts, ({ one, many }) => ({
  user: one(users, {
    fields: [trustedContacts.userId],
    references: [users.id]
  }),
  sharedEntries: many(sharedEntries),
  accessRequests: many(accessRequests)
}));

// Shared entries with extensive access control
export const sharedEntries = pgTable("shared_entries", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => vaultEntries.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => trustedContacts.id, { onDelete: 'cascade' }),
  requireApproval: boolean("require_approval").default(true),
  delayPeriod: text("delay_period").default("24 hours"),
  expiresAt: timestamp("expires_at"),
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  notesForContact: text("notes_for_contact"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const sharedEntryRelations = relations(sharedEntries, ({ one }) => ({
  entry: one(vaultEntries, {
    fields: [sharedEntries.entryId],
    references: [vaultEntries.id]
  }),
  contact: one(trustedContacts, {
    fields: [sharedEntries.contactId],
    references: [trustedContacts.id]
  })
}));

// Access requests for emergency unlock
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => trustedContacts.id, { onDelete: 'cascade' }),
  reason: text("reason").notNull(),
  urgencyLevel: text("urgency_level").default("medium"),
  status: text("status").default("pending"), // pending, approved, denied, expired
  responseMessage: text("response_message"),
  requestedAt: timestamp("requested_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at").notNull(),
  autoApproveAt: timestamp("auto_approve_at"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info")
});

export const accessRequestRelations = relations(accessRequests, ({ one }) => ({
  contact: one(trustedContacts, {
    fields: [accessRequests.contactId],
    references: [trustedContacts.id]
  })
}));

// Comprehensive activity logs
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: activityTypeEnum("action").notNull(),
  details: text("details").notNull(),
  metadata: jsonb("metadata").default({}),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  timestamp: timestamp("timestamp").defaultNow()
});

export const activityLogRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id]
  })
}));

// Notifications system
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  priority: notificationPriorityEnum("priority").default('medium'),
  isRead: boolean("is_read").default(false),
  metadata: jsonb("metadata").default({}),
  actionUrl: text("action_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow()
});

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}));

// Insert schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  fullName: true,
  twoFactorEnabled: true
});

export const insertVaultEntrySchema = createInsertSchema(vaultEntries).pick({
  userId: true,
  title: true,
  category: true,
  content: true,
  tags: true,
  status: true,
  allowEmergencyAccess: true,
  autoDeleteAt: true,
  metadata: true
});

export const insertTrustedContactSchema = createInsertSchema(trustedContacts).pick({
  userId: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  accessLevel: true,
  waitingPeriod: true,
  notificationPreferences: true
});

export const insertSharedEntrySchema = createInsertSchema(sharedEntries).pick({
  entryId: true,
  contactId: true,
  requireApproval: true,
  delayPeriod: true,
  expiresAt: true,
  notesForContact: true
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
  userId: true,
  action: true,
  details: true,
  metadata: true,
  ipAddress: true,
  deviceInfo: true
});

export const insertAccessRequestSchema = createInsertSchema(accessRequests).pick({
  contactId: true,
  reason: true,
  urgencyLevel: true,
  ipAddress: true,
  deviceInfo: true
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  title: true,
  message: true,
  type: true,
  priority: true,
  metadata: true,
  actionUrl: true,
  expiresAt: true
});

export const insertAttachmentSchema = createInsertSchema(attachments).pick({
  entryId: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  encryptedContent: true
});

export const insertUserDeviceSchema = createInsertSchema(userDevices).pick({
  userId: true,
  deviceName: true,
  deviceId: true,
  userAgent: true,
  ipAddress: true,
  isApproved: true
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVaultEntry = z.infer<typeof insertVaultEntrySchema>;
export type VaultEntry = typeof vaultEntries.$inferSelect;

export type InsertTrustedContact = z.infer<typeof insertTrustedContactSchema>;
export type TrustedContact = typeof trustedContacts.$inferSelect;

export type InsertSharedEntry = z.infer<typeof insertSharedEntrySchema>;
export type SharedEntry = typeof sharedEntries.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;
export type AccessRequest = typeof accessRequests.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;
export type UserDevice = typeof userDevices.$inferSelect;

export type InsertEntryVersion = typeof entryVersions.$inferInsert;
export type EntryVersion = typeof entryVersions.$inferSelect;
