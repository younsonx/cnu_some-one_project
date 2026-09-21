CREATE TABLE `choices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`stage` integer NOT NULL,
	`heart_color` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_choices_sender_stage_color` ON `choices` (`sender_id`,`stage`,`heart_color`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`nickname` text NOT NULL,
	`gender` text NOT NULL,
	`avatar` text DEFAULT '💌' NOT NULL,
	`job` text DEFAULT '참가자' NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_session_token_unique` ON `participants` (`session_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_nickname_unique` ON `participants` (`nickname`);