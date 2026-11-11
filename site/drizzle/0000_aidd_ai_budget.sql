CREATE TABLE `aidd_ai_budget` (
 `month` text PRIMARY KEY NOT NULL,
 `reserved_micro_usd` integer DEFAULT 0 NOT NULL CHECK (`reserved_micro_usd` >= 0),
 `request_count` integer DEFAULT 0 NOT NULL,
 `updated_at` text NOT NULL
);
