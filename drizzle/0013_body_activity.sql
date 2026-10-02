CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"intensity" text NOT NULL,
	"duration_min" integer NOT NULL,
	"kcal" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"value_cm" numeric(4, 1) NOT NULL,
	CONSTRAINT "body_measurements_user_id_date_kind_pk" PRIMARY KEY("user_id","date","kind")
);
--> statement-breakpoint
CREATE TABLE "daily_steps" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"steps" integer NOT NULL,
	CONSTRAINT "daily_steps_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"pose" text NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_photos_objectKey_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_steps" ADD CONSTRAINT "daily_steps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_id_date_index" ON "activities" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "progress_photos_user_id_date_index" ON "progress_photos" USING btree ("user_id","date");