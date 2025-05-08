import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  securityScore: integer("security_score").default(50),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
});

// Vault entry model
export const vaultEntries = pgTable("vault_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  status: text("status").default("active"),
  content: text("content").notNull(), // encrypted JSON content
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVaultEntrySchema = createInsertSchema(vaultEntries).pick({
  userId: true,
  title: true,
  category: true,
  status: true,
  content: true,
});

// Trusted contacts model
export const trustedContacts = pgTable("trusted_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: text("status").default("pending"),
  accessLevel: text("access_level").default("emergency"),
});

export const insertTrustedContactSchema = createInsertSchema(trustedContacts).pick({
  userId: true,
  name: true,
  email: true,
  status: true,
  accessLevel: true,
});

// Shared entries model
export const sharedEntries = pgTable("shared_entries", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  contactId: integer("contact_id").notNull(),
  requireApproval: boolean("require_approval").default(true),
  delayPeriod: text("delay_period").default("24 hours"),
  expiresAt: timestamp("expires_at"),
});

export const insertSharedEntrySchema = createInsertSchema(sharedEntries).pick({
  entryId: true,
  contactId: true,
  requireApproval: true,
  delayPeriod: true,
  expiresAt: true,
});

// Activity log model
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
  userId: true,
  action: true,
  details: true,
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
