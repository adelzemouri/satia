CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"owner_user_id" uuid,
	"name_fr" text NOT NULL,
	"name_en" text,
	"brand" text,
	"group_fr" text,
	"search_name" text NOT NULL,
	"kcal" numeric(7, 2) NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fat_g" numeric(7, 2) NOT NULL,
	"fiber_g" numeric(7, 2),
	"sugars_g" numeric(7, 2),
	"salt_g" numeric(7, 2),
	"density_g_per_ml" numeric(4, 2),
	"unit_weights" jsonb,
	"servings" smallint,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_source_sourceRef_unique" UNIQUE("source","source_ref")
);
--> statement-breakpoint
CREATE TABLE "recipe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"grams" numeric(7, 1) NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" text NOT NULL,
	"food_id" uuid,
	"label" text NOT NULL,
	"quantity" numeric(7, 2) NOT NULL,
	"unit" text NOT NULL,
	"grams" numeric(7, 1) NOT NULL,
	"kcal" numeric(7, 1) NOT NULL,
	"protein_g" numeric(7, 1) NOT NULL,
	"carbs_g" numeric(7, 1) NOT NULL,
	"fat_g" numeric(7, 1) NOT NULL,
	"is_estimated" boolean DEFAULT false NOT NULL,
	"input_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"glasses" smallint NOT NULL,
	CONSTRAINT "water_logs_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" numeric(5, 1) NOT NULL,
	CONSTRAINT "weight_entries_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "water_goal_glasses" smallint DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_foods_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foods_owner_user_id_index" ON "foods" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "foods_search_name_trgm" ON "foods" USING gin ("search_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipe_items_recipe_id_index" ON "recipe_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "meal_entries_user_id_date_index" ON "meal_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "meal_entries_user_id_food_id_index" ON "meal_entries" USING btree ("user_id","food_id");