CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(255),
	`source_group` varchar(255),
	`target_group` varchar(255),
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
