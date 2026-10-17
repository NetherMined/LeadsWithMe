ALTER TABLE "proposal_demos" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_demos" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "proposal_demos" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposal_demos" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;