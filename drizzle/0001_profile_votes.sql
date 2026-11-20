CREATE TABLE `vote_security` (
  `singleton` integer PRIMARY KEY NOT NULL CHECK (`singleton` = 1),
  `secret` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_votes` (
  `ip_hash` text PRIMARY KEY NOT NULL,
  `choice` text NOT NULL CHECK (`choice` IN ('up', 'down'))
);
