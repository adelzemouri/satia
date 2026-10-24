CREATE TABLE "server_errors" (
	"digest" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"path" text,
	"count" integer DEFAULT 1 NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL
);
