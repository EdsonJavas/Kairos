CREATE TABLE `academic_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`category` enum('activity','exam','assignment','notice') NOT NULL,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`startsAt` bigint NOT NULL,
	`endsAt` bigint,
	`allDay` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `event_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','professor','admin') NOT NULL DEFAULT 'student';--> statement-breakpoint
ALTER TABLE `academic_events` ADD CONSTRAINT `academic_events_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `academic_events` ADD CONSTRAINT `academic_events_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_notifications` ADD CONSTRAINT `event_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_notifications` ADD CONSTRAINT `event_notifications_eventId_academic_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `academic_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `academic_events_starts_at_idx` ON `academic_events` (`startsAt`);--> statement-breakpoint
CREATE INDEX `academic_events_category_idx` ON `academic_events` (`category`);--> statement-breakpoint
CREATE INDEX `academic_events_priority_idx` ON `academic_events` (`priority`);--> statement-breakpoint
CREATE INDEX `academic_events_created_by_idx` ON `academic_events` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `event_notifications_user_idx` ON `event_notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `event_notifications_event_idx` ON `event_notifications` (`eventId`);--> statement-breakpoint
CREATE INDEX `event_notifications_read_idx` ON `event_notifications` (`isRead`);