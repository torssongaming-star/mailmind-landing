CREATE TYPE "public"."product_access_status" AS ENUM('trialing', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "org_product_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_key" varchar(50) NOT NULL,
	"status" "product_access_status" DEFAULT 'trialing' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "quoting_usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month" date NOT NULL,
	"vertical" varchar(50) NOT NULL,
	"quotes_created" integer DEFAULT 0 NOT NULL,
	"pdfs_generated" integer DEFAULT 0 NOT NULL,
	"engine_calcs" integer DEFAULT 0 NOT NULL,
	"ai_authoring_runs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_product_access" ADD CONSTRAINT "org_product_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_product_access" ADD CONSTRAINT "org_product_access_product_key_products_key_fk" FOREIGN KEY ("product_key") REFERENCES "public"."products"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoting_usage_counters" ADD CONSTRAINT "quoting_usage_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_product_access_org_product_idx" ON "org_product_access" USING btree ("organization_id","product_key");--> statement-breakpoint
CREATE INDEX "org_product_access_org_idx" ON "org_product_access" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_key_idx" ON "products" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "quoting_usage_counters_org_month_vertical_idx" ON "quoting_usage_counters" USING btree ("organization_id","month","vertical");--> statement-breakpoint
CREATE INDEX "quoting_usage_counters_org_idx" ON "quoting_usage_counters" USING btree ("organization_id");