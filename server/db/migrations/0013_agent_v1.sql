CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"trigger_item_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "run_key" CHECK (length("agent_run"."idempotency_key") BETWEEN 1 AND 100),
	CONSTRAINT "run_deadline" CHECK ("agent_run"."deadline_at" > "agent_run"."started_at"),
	CONSTRAINT "run_terminal" CHECK (("agent_run"."status" = 'running' AND "agent_run"."finished_at" IS NULL AND "agent_run"."error" IS NULL) OR ("agent_run"."status" IN ('completed', 'cancelled') AND "agent_run"."finished_at" IS NOT NULL AND "agent_run"."finished_at" >= "agent_run"."started_at" AND "agent_run"."error" IS NULL) OR ("agent_run"."status" = 'failed' AND "agent_run"."error" IS NOT NULL AND "agent_run"."finished_at" IS NOT NULL AND "agent_run"."finished_at" >= "agent_run"."started_at" AND length("agent_run"."error") > 0))
);
--> statement-breakpoint
CREATE TABLE "conversation_item" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"author_type" text NOT NULL,
	"author_user_id" text,
	"content" jsonb NOT NULL,
	"context" jsonb,
	"agent_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_id" CHECK (length("conversation_item"."id") BETWEEN 1 AND 100),
	CONSTRAINT "item_seq" CHECK ("conversation_item"."seq" > 0),
	CONSTRAINT "item_author" CHECK (("conversation_item"."author_type" = 'customer' AND "conversation_item"."author_user_id" IS NOT NULL AND "conversation_item"."agent_run_id" IS NULL) OR ("conversation_item"."author_type" = 'agent' AND "conversation_item"."author_user_id" IS NULL AND "conversation_item"."agent_run_id" IS NOT NULL AND "conversation_item"."context" IS NULL)),
	CONSTRAINT "item_content" CHECK ("conversation_item"."content" ? 'parts' AND jsonb_typeof("conversation_item"."content") = 'object' AND jsonb_typeof("conversation_item"."content"->'parts') = 'array' AND jsonb_array_length("conversation_item"."content"->'parts') > 0)
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "last_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "help_article" ADD COLUMN "ai_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_item_id_conversation_item_id_fk" FOREIGN KEY ("trigger_item_id") REFERENCES "public"."conversation_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_item" ADD CONSTRAINT "conversation_item_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_item" ADD CONSTRAINT "conversation_item_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_item" ADD CONSTRAINT "conversation_item_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_request" ON "agent_run" USING btree ("conversation_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_active" ON "agent_run" USING btree ("conversation_id") WHERE "agent_run"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_completed_input" ON "agent_run" USING btree ("trigger_item_id") WHERE "agent_run"."status" = 'completed';--> statement-breakpoint
CREATE INDEX "agent_run_history" ON "agent_run" USING btree ("conversation_id","started_at","id");--> statement-breakpoint
CREATE INDEX "agent_run_attempts" ON "agent_run" USING btree ("trigger_item_id","started_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_item_conversation_seq" ON "conversation_item" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_item_run" ON "conversation_item" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_unread" ON "conversation" USING btree ("org_id","user_id","last_message_at" DESC,"id" DESC) WHERE "conversation"."unread" = true AND "conversation"."last_seq" > 0;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_last_seq" CHECK ("conversation"."last_seq" >= 0);
--> statement-breakpoint
-- MemoryPG storage contract; initialized by migrations, never by a request.
CREATE TABLE IF NOT EXISTS public.mastra_messages (
    id text PRIMARY KEY NOT NULL,
    thread_id text NOT NULL,
    content text NOT NULL,
    role text NOT NULL,
    type text NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "resourceId" text,
    "createdAtZ" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.mastra_observational_memory (
    id text PRIMARY KEY NOT NULL,
    "lookupKey" text NOT NULL,
    scope text NOT NULL,
    "resourceId" text,
    "threadId" text,
    "activeObservations" text NOT NULL,
    "activeObservationsPendingUpdate" text,
    "originType" text NOT NULL,
    config text NOT NULL,
    "generationCount" integer NOT NULL,
    "lastObservedAt" timestamp without time zone,
    "lastReflectionAt" timestamp without time zone,
    "pendingMessageTokens" integer NOT NULL,
    "totalTokensObserved" integer NOT NULL,
    "observationTokenCount" integer NOT NULL,
    "isObserving" boolean NOT NULL,
    "isReflecting" boolean NOT NULL,
    "observedMessageIds" jsonb,
    "observedTimezone" text,
    "bufferedObservations" text,
    "bufferedObservationTokens" integer,
    "bufferedMessageIds" jsonb,
    "bufferedReflection" text,
    "bufferedReflectionTokens" integer,
    "bufferedReflectionInputTokens" integer,
    "reflectedObservationLineCount" integer,
    "bufferedObservationChunks" jsonb,
    "isBufferingObservation" boolean NOT NULL,
    "isBufferingReflection" boolean NOT NULL,
    "lastBufferedAtTokens" integer NOT NULL,
    "lastBufferedAtTime" timestamp without time zone,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "lastObservedAtZ" timestamp with time zone DEFAULT now(),
    "lastReflectionAtZ" timestamp with time zone DEFAULT now(),
    "lastBufferedAtTimeZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.mastra_resources (
    id text PRIMARY KEY NOT NULL,
    "workingMemory" text,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.mastra_threads (
    id text PRIMARY KEY NOT NULL,
    "resourceId" text NOT NULL,
    title text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_om_lookup_key ON public.mastra_observational_memory USING btree ("lookupKey");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mastra_messages_thread_id_createdat_idx ON public.mastra_messages USING btree (thread_id, "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mastra_threads_resourceid_createdat_idx ON public.mastra_threads USING btree ("resourceId", "createdAt" DESC);
