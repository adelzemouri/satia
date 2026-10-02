CREATE TABLE "daily_checkins" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hunger" smallint,
	"energy" smallint,
	"mood" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_checkins_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "nutriscore" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "nova_group" smallint;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "fruit_veg_share" numeric(3, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "foods" SET "fruit_veg_share" = 1 WHERE "source" = 'ciqual' AND "group_fr" IN ('fruits', 'légumes');
