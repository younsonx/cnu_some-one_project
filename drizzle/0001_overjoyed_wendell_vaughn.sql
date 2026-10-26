CREATE TABLE `event_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`current_stage` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `event_state` (`id`, `current_stage`) VALUES (1, 1);--> statement-breakpoint
CREATE TABLE `participant_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `participants` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `password_salt` text;
