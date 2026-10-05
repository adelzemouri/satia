ALTER TABLE "shared_meals" ALTER COLUMN "food_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shared_meals" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "shared_meals" ADD COLUMN "items" jsonb;