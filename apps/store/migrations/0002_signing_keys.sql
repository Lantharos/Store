CREATE TABLE `signing_key` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`sealed_seed` text NOT NULL,
	`created_at` integer NOT NULL
);
