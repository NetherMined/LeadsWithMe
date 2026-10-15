CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"has_meta_ads" boolean DEFAULT false NOT NULL,
	"meta_ad_count" integer DEFAULT 0 NOT NULL,
	"has_google_ads" boolean DEFAULT false NOT NULL,
	"domain_authority" integer,
	"backlink_estimate" integer,
	"meta_ad_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"has_remarketing_pixel" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ads_audits_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service" text NOT NULL,
	"operation" text NOT NULL,
	"estimated_cost" numeric(10, 6) DEFAULT 0 NOT NULL,
	"tokens_input" integer,
	"tokens_output" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"website" text,
	"category" text NOT NULL,
	"rating" numeric(3, 1),
	"review_count" integer DEFAULT 0 NOT NULL,
	"latitude" numeric(10, 7) DEFAULT 0 NOT NULL,
	"longitude" numeric(10, 7) DEFAULT 0 NOT NULL,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email" text,
	"emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mobile" text,
	"whatsapp" text,
	"hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_term" text,
	"address_street" text,
	"address_suburb" text,
	"address_city" text,
	"address_postal_code" text,
	"address_country" text,
	"google_maps_url" text,
	"feature_id" text,
	"rating_distribution" jsonb,
	"reviews" jsonb,
	"is_open_now" boolean,
	"current_status" text,
	"hours_weekly" jsonb,
	"photo_count" integer,
	"photos" jsonb,
	"photo_primary" text,
	"photo_references" jsonb,
	"social_channel_count" integer,
	"products" jsonb,
	"services_url" text,
	"appointments_url" text,
	"description" text,
	"has_updates" boolean,
	"updates_url" text,
	"popular_times" jsonb,
	"live_busyness" text,
	"typical_visit_duration" text,
	"service_area_primary" text,
	"service_areas" jsonb,
	"related_businesses" jsonb,
	"review_topics" jsonb,
	"web_results" jsonb,
	"is_claimed" boolean,
	"gmb_claim_url" text,
	"competitors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"google_file_id" text,
	"google_file_url" text,
	"business_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exports_type_check" CHECK ("exports"."type" IN ('sheets', 'docs', 'drive', 'pdf'))
);
--> statement-breakpoint
CREATE TABLE "marketing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"executive_summary" text NOT NULL,
	"website_recommendations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"social_recommendations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"advertising_recommendations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quick_wins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"medium_term" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"long_term" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outreach_email_draft" text DEFAULT '' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_used" text DEFAULT 'claude-haiku-4-5' NOT NULL,
	CONSTRAINT "marketing_plans_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "outreach_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"loom_script" text,
	"email_subject" text,
	"email_body" text,
	"linkedin_connect_note" text,
	"linkedin_followup" text,
	"flat_fee_amount" numeric(10, 2),
	"flat_fee_currency" text DEFAULT 'GBP',
	"delivery_days" integer DEFAULT 5,
	"identified_issues" jsonb DEFAULT '[]'::jsonb,
	"loom_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outreach_pipeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'not_contacted' NOT NULL,
	"channel" text DEFAULT 'email',
	"first_contact_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"reply_received_at" timestamp with time zone,
	"outcome_notes" text,
	"won_amount" numeric,
	"lost_reason" text,
	"next_followup_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "outreach_pipeline_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "proof_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"pagespeed_mobile" integer,
	"pagespeed_desktop" integer,
	"seo_score" integer,
	"accessibility_score" integer,
	"screenshot_url" text,
	"notes" text,
	"captured_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "proof_snapshots_phase_check" CHECK ("proof_snapshots"."phase" IN ('before', 'after'))
);
--> statement-breakpoint
CREATE TABLE "proposal_demos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"html" text,
	"proposal_md" text,
	"screenshot_desktop_url" text,
	"screenshot_mobile_url" text,
	"demo_site_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"grade" text DEFAULT 'F' NOT NULL,
	"label" text DEFAULT 'Digital Absent' NOT NULL,
	"website_score" integer DEFAULT 0 NOT NULL,
	"social_score" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"advertising_score" integer DEFAULT 0 NOT NULL,
	"reviews_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "search_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"location" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"limit_count" integer DEFAULT 20 NOT NULL,
	"last_run_at" timestamp with time zone,
	"result_count" integer DEFAULT 0 NOT NULL,
	"positioning_profile_id" uuid,
	"target_currency" text DEFAULT 'GBP',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "social_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platform_coverage_score" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"missing_platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_audits_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"performance_score" integer DEFAULT 0 NOT NULL,
	"seo_score" integer DEFAULT 0 NOT NULL,
	"accessibility_score" integer DEFAULT 0 NOT NULL,
	"mobile_friendly" boolean DEFAULT false NOT NULL,
	"has_ssl" boolean DEFAULT false NOT NULL,
	"has_analytics" boolean DEFAULT false NOT NULL,
	"cms_detected" text,
	"page_speed_ms" integer DEFAULT 0 NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"h1_count" integer DEFAULT 0 NOT NULL,
	"has_sitemap" boolean DEFAULT false NOT NULL,
	"has_blog" boolean DEFAULT false NOT NULL,
	"blog_last_post_date" timestamp with time zone,
	"tech_stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"has_deals" boolean DEFAULT false NOT NULL,
	"deals_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"has_chat_widget" boolean DEFAULT false NOT NULL,
	"has_cookie_consent" boolean DEFAULT false NOT NULL,
	"og_image" text,
	"has_robots_txt" boolean DEFAULT false NOT NULL,
	"mobile_viewport" boolean DEFAULT false NOT NULL,
	"contact_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structured_data" boolean DEFAULT false NOT NULL,
	"canonical_url" text,
	"open_graph_tags" boolean DEFAULT false NOT NULL,
	"tech_stack_detailed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_deals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_audits_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads_audits" ADD CONSTRAINT "ads_audits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_assets" ADD CONSTRAINT "outreach_assets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_assets" ADD CONSTRAINT "outreach_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_pipeline" ADD CONSTRAINT "outreach_pipeline_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_pipeline" ADD CONSTRAINT "outreach_pipeline_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_snapshots" ADD CONSTRAINT "proof_snapshots_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_snapshots" ADD CONSTRAINT "proof_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_demos" ADD CONSTRAINT "proposal_demos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_demos" ADD CONSTRAINT "proposal_demos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_sets" ADD CONSTRAINT "search_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_audits" ADD CONSTRAINT "social_audits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_audits" ADD CONSTRAINT "website_audits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_usage_user_time" ON "api_usage" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_api_usage_user_service_time" ON "api_usage" USING btree ("user_id","service","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_user_place_key" ON "businesses" USING btree ("user_id","place_id");--> statement-breakpoint
CREATE INDEX "idx_businesses_place_id" ON "businesses" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "idx_businesses_category" ON "businesses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_exports_user_id" ON "exports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_marketing_plans_user_id" ON "marketing_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_assets_business_id" ON "outreach_assets" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_assets_user_id" ON "outreach_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_pipeline_user_id" ON "outreach_pipeline" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_pipeline_status" ON "outreach_pipeline" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_outreach_pipeline_next_followup" ON "outreach_pipeline" USING btree ("next_followup_at");--> statement-breakpoint
CREATE INDEX "idx_proof_snapshots_business_id" ON "proof_snapshots" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_proof_snapshots_user_id" ON "proof_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proposal_demos_business_idx" ON "proposal_demos" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "proposal_demos_user_idx" ON "proposal_demos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scores_total_score" ON "scores" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "idx_search_sets_user_id" ON "search_sets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "verifications" USING btree ("identifier");