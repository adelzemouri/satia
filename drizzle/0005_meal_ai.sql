CREATE TABLE "containers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"volume_ml" numeric(6, 0),
	"diameter_cm" numeric(4, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ai_label" text NOT NULL,
	"ai_grams" numeric(7, 1) NOT NULL,
	"food_id" uuid NOT NULL,
	"grams" numeric(7, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_expressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phrase" text NOT NULL,
	"phrase_normalized" text NOT NULL,
	"food_id" uuid NOT NULL,
	"quantity" numeric(7, 2) NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_expressions_userId_phraseNormalized_unique" UNIQUE("user_id","phrase_normalized")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_objectKey_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "meal_entries" ADD COLUMN "photo_id" uuid;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_corrections" ADD CONSTRAINT "food_corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_corrections" ADD CONSTRAINT "food_corrections_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expressions" ADD CONSTRAINT "personal_expressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expressions" ADD CONSTRAINT "personal_expressions_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "containers_user_id_index" ON "containers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "food_corrections_user_id_ai_label_index" ON "food_corrections" USING btree ("user_id","ai_label");--> statement-breakpoint
CREATE INDEX "photos_user_id_index" ON "photos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "photos_created_at_index" ON "photos" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;