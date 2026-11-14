CREATE TABLE "delay_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expect_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"schedule_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid,
	"item_id" text,
	"result" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"manual_retry" boolean DEFAULT false NOT NULL,
	"delivery_mode" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_item" DROP CONSTRAINT "item_author";--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "status" text DEFAULT 'ai_handling' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "priority" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "state_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "customer_read_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_item" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "source_conversation_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_delay_message_active" ON "delay_message" USING btree ("expect_at","id") WHERE "delay_message"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "idx_scheduled_task_due" ON "scheduled_task" USING btree ("schedule_at","id") WHERE "scheduled_task"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_scheduled_task_processing" ON "scheduled_task" USING btree ("updated_at") WHERE "scheduled_task"."status" = 'processing';--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_task_reference" ON "scheduled_task" USING btree ("kind","ref_id") WHERE "scheduled_task"."item_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_task_reply" ON "scheduled_task" USING btree ("item_id") WHERE "scheduled_task"."kind" = 'inbox_email';--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_org_id_unique" UNIQUE("org_id","id");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_source_conversation_fk" FOREIGN KEY ("org_id","source_conversation_id") REFERENCES "public"."conversation"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inbox_status_time" ON "conversation" USING btree ("org_id","status","last_message_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "idx_inbox_time" ON "conversation" USING btree ("org_id","last_message_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "idx_conversation_due" ON "conversation" USING btree ("state_due_at","id") WHERE "conversation"."state_due_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_post_source_conversation" ON "post" USING btree ("org_id","source_conversation_id") WHERE "post"."source_conversation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_status" CHECK ("conversation"."status" IN ('ai_handling','open','pending','snoozed','closed'));--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_priority" CHECK ("conversation"."priority" IN (0,1));--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_state_due" CHECK ("conversation"."status" = 'ai_handling' OR ("conversation"."status" IN ('pending','snoozed') AND "conversation"."state_due_at" IS NOT NULL) OR ("conversation"."status" IN ('open','closed') AND "conversation"."state_due_at" IS NULL));--> statement-breakpoint
ALTER TABLE "conversation_item" ADD CONSTRAINT "item_request_hash" CHECK ("conversation_item"."request_hash" IS NULL OR "conversation_item"."request_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "conversation_item" ADD CONSTRAINT "item_author" CHECK (("conversation_item"."author_type" = 'customer' AND "conversation_item"."author_user_id" IS NOT NULL AND "conversation_item"."agent_run_id" IS NULL) OR ("conversation_item"."author_type" = 'agent' AND "conversation_item"."author_user_id" IS NULL AND "conversation_item"."agent_run_id" IS NOT NULL AND "conversation_item"."context" IS NULL) OR ("conversation_item"."author_type" = 'staff' AND "conversation_item"."author_user_id" IS NOT NULL AND "conversation_item"."agent_run_id" IS NULL AND "conversation_item"."context" IS NULL) OR ("conversation_item"."author_type" = 'system' AND "conversation_item"."agent_run_id" IS NULL AND "conversation_item"."context" IS NULL));
