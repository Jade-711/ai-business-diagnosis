CREATE TABLE `workflow_requests` (
 `id` text PRIMARY KEY NOT NULL,
 `configurations` text NOT NULL,
 `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workflow_requests_expiry` ON `workflow_requests` (`expires_at`);
