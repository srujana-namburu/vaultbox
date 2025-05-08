CREATE TYPE "public"."access_level" AS ENUM('emergency_only', 'full_access', 'limited_access', 'temporary_access');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('entry_created', 'entry_updated', 'entry_shared', 'entry_deleted', 'contact_added', 'contact_updated', 'contact_deleted', 'login', 'logout', 'account_created', 'security_alert', 'access_timeout', 'document_upload', 'security_settings_changed');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('personal_documents', 'financial_records', 'account_credentials', 'medical_information', 'other');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('pending', 'active', 'declined', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'locked', 'suspended', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."vault_entry_status" AS ENUM('active', 'locked', 'shared', 'expiring');--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"reason" text NOT NULL,
	"urgency_level" text DEFAULT 'medium',
	"status" text DEFAULT 'pending',
	"response_message" text,
	"requested_at" timestamp DEFAULT now(),
	"responded_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"auto_approve_at" timestamp,
	"ip_address" text,
	"device_info" text
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" "activity_type" NOT NULL,
	"details" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"device_info" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"encrypted_content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entry_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"changed_by" integer NOT NULL,
	"change_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium',
	"is_read" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"action_url" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"require_approval" boolean DEFAULT true,
	"delay_period" text DEFAULT '24 hours',
	"expires_at" timestamp,
	"access_count" integer DEFAULT 0,
	"last_accessed_at" timestamp,
	"notes_for_contact" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trusted_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"status" "contact_status" DEFAULT 'pending',
	"access_level" "access_level" NOT NULL,
	"waiting_period" text DEFAULT '24 hours',
	"notification_preferences" jsonb DEFAULT '{}'::jsonb,
	"verification_code" text,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"device_name" text NOT NULL,
	"device_id" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"last_used" timestamp DEFAULT now(),
	"is_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"security_score" integer DEFAULT 50,
	"status" "user_status" DEFAULT 'active',
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" text,
	"recovery_keys" jsonb,
	"failed_login_attempts" integer DEFAULT 0,
	"last_failed_login" timestamp,
	"password_updated_at" timestamp DEFAULT now(),
	"last_login" timestamp,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vault_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"category" "category" NOT NULL,
	"content" text NOT NULL,
	"tags" text[],
	"status" "vault_entry_status" DEFAULT 'active',
	"auto_delete_at" timestamp,
	"allow_emergency_access" boolean DEFAULT false,
	"version_number" integer DEFAULT 1,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_contact_id_trusted_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."trusted_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_entry_id_vault_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_versions" ADD CONSTRAINT "entry_versions_entry_id_vault_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_versions" ADD CONSTRAINT "entry_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_entries" ADD CONSTRAINT "shared_entries_entry_id_vault_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_entries" ADD CONSTRAINT "shared_entries_contact_id_trusted_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."trusted_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;