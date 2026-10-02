ALTER TABLE "foods" ADD COLUMN "image_url" text;--> statement-breakpoint
-- Les produits déjà en cache seront relus sur Open Food Facts au prochain scan, pour récupérer leur photo.
UPDATE "foods" SET "fetched_at" = NULL WHERE "source" = 'off';
