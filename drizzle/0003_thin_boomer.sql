CREATE TYPE "public"."pre_launch_intent_status" AS ENUM('pending', 'contacted', 'converted', 'declined');--> statement-breakpoint
CREATE TABLE "pre_launch_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(255) NOT NULL,
	"role" varchar(100),
	"company_size" varchar(32),
	"phone" varchar(64),
	"intent_text" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"status" "pre_launch_intent_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"email_verified_at" timestamp with time zone,
	"verification_token" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pre_launch_intents_email_company_idx" ON "pre_launch_intents" USING btree ("email","company");--> statement-breakpoint
CREATE INDEX "pre_launch_intents_signed_at_idx" ON "pre_launch_intents" USING btree ("signed_at");--> statement-breakpoint
CREATE INDEX "pre_launch_intents_status_idx" ON "pre_launch_intents" USING btree ("status");