CREATE TABLE "signature_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_name" varchar(255),
	"mime_type" varchar(100) NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signature_assets" ADD CONSTRAINT "signature_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signature_assets_org_idx" ON "signature_assets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_drafts_pending_one_per_thread_idx" ON "ai_drafts" USING btree ("thread_id") WHERE status IN ('pending', 'edited');--> statement-breakpoint
CREATE INDEX "email_threads_status_last_msg_idx" ON "email_threads" USING btree ("status","last_message_at");