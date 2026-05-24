ALTER TABLE "signature_assets" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "signature_assets" ADD COLUMN "blob_url" text;