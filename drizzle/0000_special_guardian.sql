CREATE TABLE `auth_attempts` (
	`bucket` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`resets_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`readiness` integer NOT NULL,
	`fear` integer NOT NULL,
	`movement` text NOT NULL,
	`mood` text NOT NULL,
	`win` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "readiness_range" CHECK(readiness BETWEEN 0 AND 10),
	CONSTRAINT "fear_range" CHECK(fear BETWEEN 0 AND 10),
	CONSTRAINT "mood_values" CHECK(mood IN ('hopeful', 'steady', 'unsure', 'low'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_user_day` ON `checkins` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE INDEX `checkins_user_date` ON `checkins` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`user_id` text NOT NULL,
	`milestone_key` text NOT NULL,
	`earned_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `milestone_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`gratitude` text DEFAULT '' NOT NULL,
	`challenge` text DEFAULT '' NOT NULL,
	`reframe` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reflections_user_day` ON `reflections` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE INDEX `reflections_user_date` ON `reflections` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`recovery_focus` text DEFAULT 'Building movement confidence' NOT NULL,
	`timezone` text DEFAULT 'Asia/Singapore' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "users_role" CHECK(role IN ('user', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);