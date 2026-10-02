CREATE TABLE "larger_days" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "larger_days_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "metabolism_checks" (
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"status" text NOT NULL,
	"estimated_tdee" integer NOT NULL,
	"measured_tdee" integer,
	"kcal_before" smallint NOT NULL,
	"kcal_after" smallint NOT NULL,
	"missing" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metabolism_checks_user_id_week_start_pk" PRIMARY KEY("user_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "budget_mode" text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "goal_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "larger_days" ADD CONSTRAINT "larger_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metabolism_checks" ADD CONSTRAINT "metabolism_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;