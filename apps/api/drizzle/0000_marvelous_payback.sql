CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`nama_model` text NOT NULL,
	`nama_tampilan` text NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`prioritas` integer DEFAULT 0 NOT NULL,
	`skor_kualitas` integer DEFAULT 0 NOT NULL,
	`skor_kecepatan` integer DEFAULT 0 NOT NULL,
	`biaya_input` integer DEFAULT 0 NOT NULL,
	`biaya_output` integer DEFAULT 0 NOT NULL,
	`kapasitas` text,
	`dibuat_pada` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`jenis` text NOT NULL,
	`base_url` text,
	`api_key` text,
	`aktif` integer DEFAULT true NOT NULL,
	`dibuat_pada` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`waktu` integer NOT NULL,
	`model_diminta` text NOT NULL,
	`provider_aktual` text,
	`model_aktual` text,
	`status` text NOT NULL,
	`durasi_ms` integer NOT NULL,
	`token_input` integer,
	`token_output` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `routing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`nama_virtual` text NOT NULL,
	`strategi` text NOT NULL,
	`aktif` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`kunci` text PRIMARY KEY NOT NULL,
	`nilai` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routing_rules_nama_virtual_unique` ON `routing_rules` (`nama_virtual`);