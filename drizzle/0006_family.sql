CREATE TABLE "shared_meal_shares" (
	"shared_meal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"entry_id" uuid,
	"responded_at" timestamp with time zone,
	CONSTRAINT "shared_meal_shares_shared_meal_id_user_id_pk" PRIMARY KEY("shared_meal_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shared_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"created_by" uuid,
	"food_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" text NOT NULL,
	"total_parts" numeric(4, 1) NOT NULL,
	"total_grams" numeric(7, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "shared_meal_shares" ADD CONSTRAINT "shared_meal_shares_shared_meal_id_shared_meals_id_fk" FOREIGN KEY ("shared_meal_id") REFERENCES "public"."shared_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meal_shares" ADD CONSTRAINT "shared_meal_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meal_shares" ADD CONSTRAINT "shared_meal_shares_entry_id_meal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."meal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meals" ADD CONSTRAINT "shared_meals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meals" ADD CONSTRAINT "shared_meals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meals" ADD CONSTRAINT "shared_meals_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_meal_shares_user_id_status_index" ON "shared_meal_shares" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "shared_meals_household_id_date_index" ON "shared_meals" USING btree ("household_id","date");--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foods_household_id_index" ON "foods" USING btree ("household_id");