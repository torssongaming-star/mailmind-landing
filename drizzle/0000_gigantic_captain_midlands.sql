CREATE TYPE "public"."admin_customer_status" AS ENUM('internal_test', 'pilot', 'active_customer', 'enterprise_lead', 'enterprise_customer', 'churned');--> statement-breakpoint
CREATE TYPE "public"."admin_knowledge_category" AS ENUM('enterprise', 'gdpr', 'security', 'dpa', 'ai_policy', 'pilot', 'support', 'billing', 'onboarding', 'internal_process', 'other');--> statement-breakpoint
CREATE TYPE "public"."admin_knowledge_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."admin_note_subject_type" AS ENUM('user', 'organization', 'enterprise', 'general');--> statement-breakpoint
CREATE TYPE "public"."ai_tone" AS ENUM('formal', 'friendly', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."draft_action" AS ENUM('ask', 'summarize', 'escalate');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('pending', 'approved', 'edited', 'sending', 'sent', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."inbox_provider" AS ENUM('mailmind', 'imap', 'gmail', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('connecting', 'active', 'error', 'paused');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('customer', 'assistant', 'agent');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('starter', 'team', 'business');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'incomplete', 'paused');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('open', 'waiting', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_clerk_user_id" varchar(255) NOT NULL,
	"actor_email" varchar(320) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_clerk_user_id" varchar(255),
	"target_organization_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"clerk_user_id" varchar(255),
	"status" "admin_customer_status" DEFAULT 'internal_test' NOT NULL,
	"owner_name" varchar(255),
	"contact_name" varchar(255),
	"contact_email" varchar(320),
	"start_date" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_knowledge_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"category" "admin_knowledge_category" DEFAULT 'other' NOT NULL,
	"status" "admin_knowledge_status" DEFAULT 'draft' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"author_clerk_user_id" varchar(255) NOT NULL,
	"author_email" varchar(320),
	"updated_by_clerk_user_id" varchar(255),
	"updated_by_email" varchar(320),
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_knowledge_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "admin_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "admin_note_subject_type" NOT NULL,
	"target_clerk_user_id" varchar(255),
	"target_organization_id" uuid,
	"author_clerk_user_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" "draft_action" NOT NULL,
	"body_text" text,
	"metadata" jsonb,
	"status" "draft_status" DEFAULT 'pending' NOT NULL,
	"ai_model" varchar(100) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"is_dry_run" boolean DEFAULT false NOT NULL,
	"dry_run_approved" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tone" "ai_tone" DEFAULT 'friendly' NOT NULL,
	"language" varchar(10) DEFAULT 'sv' NOT NULL,
	"max_interactions" integer DEFAULT 2 NOT NULL,
	"signature" text,
	"dry_run_enabled" boolean DEFAULT false NOT NULL,
	"auto_send_enabled" boolean DEFAULT false NOT NULL,
	"bulk_filter_enabled" boolean DEFAULT true NOT NULL,
	"bulk_filter_whitelist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"route_to_email" varchar(320),
	"is_default" boolean DEFAULT false NOT NULL,
	"sla_hours" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"external_message_id" varchar(255),
	"body_text" text,
	"body_html" text,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inbox_id" uuid,
	"external_thread_id" varchar(255),
	"subject" varchar(500),
	"from_email" varchar(320) NOT NULL,
	"from_name" varchar(255),
	"status" "thread_status" DEFAULT 'open' NOT NULL,
	"case_type_slug" varchar(100),
	"collected_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"triage_failed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "inbox_provider" NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(255),
	"status" "inbox_status" DEFAULT 'connecting' NOT NULL,
	"config" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid,
	"body_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" "plan" NOT NULL,
	"max_users" integer DEFAULT 2 NOT NULL,
	"max_inboxes" integer DEFAULT 1 NOT NULL,
	"max_ai_drafts_per_month" integer DEFAULT 500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "license_entitlements_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "org_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"token" varchar(64) NOT NULL,
	"invited_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255),
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id"),
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" varchar(255) NOT NULL,
	"auth" varchar(255) NOT NULL,
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reply_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(100),
	"body_text" text NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender_blocklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pattern" varchar(320) NOT NULL,
	"reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"plan" "plan" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"billing_period" varchar(20) DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month" date NOT NULL,
	"ai_drafts_used" integer DEFAULT 0 NOT NULL,
	"emails_processed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"organization_id" uuid,
	"email" varchar(320) NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"locale" varchar(10) DEFAULT 'sv' NOT NULL,
	"signature" text,
	"append_signature" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid,
	"status_code" integer,
	"duration_ms" integer,
	"error" text,
	"status" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"url" varchar(2048) NOT NULL,
	"case_type_slug" varchar(100) DEFAULT '*' NOT NULL,
	"secret" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_status" varchar(20),
	"last_fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_customer_profiles" ADD CONSTRAINT "admin_customer_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_types" ADD CONSTRAINT "case_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_entitlements" ADD CONSTRAINT "license_entitlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_templates" ADD CONSTRAINT "reply_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_blocklist" ADD CONSTRAINT "sender_blocklist_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_idx" ON "admin_audit_logs" USING btree ("actor_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_customer_profiles_org_id_idx" ON "admin_customer_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "admin_customer_profiles_status_idx" ON "admin_customer_profiles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_knowledge_articles_slug_idx" ON "admin_knowledge_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "admin_knowledge_articles_category_idx" ON "admin_knowledge_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "admin_knowledge_articles_status_idx" ON "admin_knowledge_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_notes_target_user_idx" ON "admin_notes" USING btree ("target_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_notes_target_org_idx" ON "admin_notes" USING btree ("target_organization_id");--> statement-breakpoint
CREATE INDEX "ai_drafts_thread_idx" ON "ai_drafts" USING btree ("thread_id","generated_at");--> statement-breakpoint
CREATE INDEX "ai_drafts_org_status_idx" ON "ai_drafts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_settings_org_id_idx" ON "ai_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_types_org_slug_idx" ON "case_types" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "case_types_org_idx" ON "case_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_messages_thread_idx" ON "email_messages" USING btree ("thread_id","sent_at");--> statement-breakpoint
CREATE INDEX "email_messages_org_idx" ON "email_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_external_id_uniq" ON "email_messages" USING btree ("external_message_id") WHERE "email_messages"."external_message_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "email_threads_org_status_idx" ON "email_threads" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "email_threads_org_updated_idx" ON "email_threads" USING btree ("organization_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_threads_external_idx" ON "email_threads" USING btree ("external_thread_id");--> statement-breakpoint
CREATE INDEX "email_threads_snoozed_idx" ON "email_threads" USING btree ("snoozed_until");--> statement-breakpoint
CREATE INDEX "email_threads_org_from_idx" ON "email_threads" USING btree ("organization_id","from_email");--> statement-breakpoint
CREATE INDEX "email_threads_tags_gin" ON "email_threads" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "inboxes_email_idx" ON "inboxes" USING btree ("email");--> statement-breakpoint
CREATE INDEX "inboxes_org_idx" ON "inboxes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "internal_notes_thread_idx" ON "internal_notes" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_entries_org_idx" ON "knowledge_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_org_active_idx" ON "knowledge_entries" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "license_entitlements_org_id_idx" ON "license_entitlements" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invites_token_idx" ON "org_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "org_invites_org_idx" ON "org_invites" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_idx" ON "organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_stripe_customer_id_idx" ON "organizations" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_org_idx" ON "push_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reply_templates_org_slug_idx" ON "reply_templates" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "reply_templates_org_idx" ON "reply_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sender_blocklist_org_idx" ON "sender_blocklist" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_blocklist_org_pattern_idx" ON "sender_blocklist" USING btree ("organization_id","pattern");--> statement-breakpoint
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_sub_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_counters_org_month_idx" ON "usage_counters" USING btree ("organization_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_idx" ON "webhook_deliveries" USING btree ("endpoint_id","sent_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_org_idx" ON "webhook_deliveries" USING btree ("organization_id","sent_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_org_idx" ON "webhook_endpoints" USING btree ("organization_id");