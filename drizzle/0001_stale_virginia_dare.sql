CREATE TABLE `fear_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`movement` text NOT NULL,
	`before_score` integer NOT NULL,
	`after_score` integer,
	`context` text DEFAULT '' NOT NULL,
	`support` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "before_score_range" CHECK(before_score BETWEEN 0 AND 10),
	CONSTRAINT "after_score_range" CHECK(after_score BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE INDEX `fear_entries_user_date` ON `fear_entries` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `ladder_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`expected_fear` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`position` integer NOT NULL,
	`completed_at` text,
	`completed_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "expected_fear_range" CHECK(expected_fear BETWEEN 0 AND 10),
	CONSTRAINT "ladder_status_values" CHECK(status IN ('planned', 'working', 'complete'))
);
--> statement-breakpoint
CREATE INDEX `ladder_steps_user_position` ON `ladder_steps` (`user_id`,`position`);--> statement-breakpoint
CREATE TABLE `micro_wins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`win` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`gratitude` text DEFAULT '' NOT NULL,
	`challenge` text DEFAULT '' NOT NULL,
	`reframe` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "win_category_values" CHECK(category IN ('courage', 'movement', 'self_kindness', 'gratitude', 'other'))
);
--> statement-breakpoint
CREATE INDEX `micro_wins_user_date` ON `micro_wins` (`user_id`,`entry_date`);