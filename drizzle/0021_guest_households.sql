ALTER TABLE "access_links" ADD COLUMN "separate_household" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "managed_by" uuid;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_managed_by_households_id_fk" FOREIGN KEY ("managed_by") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;