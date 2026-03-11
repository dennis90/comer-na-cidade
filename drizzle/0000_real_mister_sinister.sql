CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_slug_unique` ON `category` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_unique` ON `category` (`name`);--> statement-breakpoint
CREATE TABLE `city` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`ibge_code` text NOT NULL,
	`population` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `city_slug_unique` ON `city` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `city_ibge_code_unique` ON `city` (`ibge_code`);--> statement-breakpoint
CREATE INDEX `city_state_idx` ON `city` (`state`);--> statement-breakpoint
CREATE TABLE `commerce_category` (
	`commerce_id` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`commerce_id`, `category_id`),
	FOREIGN KEY (`commerce_id`) REFERENCES `commerce`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `commerce_modality` (
	`commerce_id` text NOT NULL,
	`modality` text NOT NULL,
	`delivery_radius_km` real,
	PRIMARY KEY(`commerce_id`, `modality`),
	FOREIGN KEY (`commerce_id`) REFERENCES `commerce`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `commerce` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`address` text,
	`city_id` text,
	`lat` real,
	`lng` real,
	`phone` text,
	`whatsapp` text,
	`instagram` text,
	`logo_url` text,
	`published` integer DEFAULT false NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`city_id`) REFERENCES `city`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_slug_unique` ON `commerce` (`slug`);--> statement-breakpoint
CREATE INDEX `commerce_owner_idx` ON `commerce` (`owner_id`);--> statement-breakpoint
CREATE INDEX `commerce_city_idx` ON `commerce` (`city_id`);--> statement-breakpoint
CREATE INDEX `commerce_published_idx` ON `commerce` (`published`);--> statement-breakpoint
CREATE TABLE `menu` (
	`id` text PRIMARY KEY NOT NULL,
	`commerce_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`commerce_id`) REFERENCES `commerce`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_commerce_id_unique` ON `menu` (`commerce_id`);--> statement-breakpoint
CREATE TABLE `operating_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`commerce_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	FOREIGN KEY (`commerce_id`) REFERENCES `commerce`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hours_commerce_idx` ON `operating_hours` (`commerce_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
