CREATE TABLE "feedback_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"page" text,
	"app_version" text,
	"user_agent" text,
	"error_detail" text,
	"screenshot_key" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_messages_screenshotKey_unique" UNIQUE("screenshot_key")
);
--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_messages_household_id_created_at_index" ON "feedback_messages" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_messages_user_id_index" ON "feedback_messages" USING btree ("user_id");