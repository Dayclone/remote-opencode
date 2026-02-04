# Changelog

All notable changes to this project will be documented in this file.

## [1.0.9] - 2026-02-04

### Added
- New `/model` slash command to list and set AI models per channel.
- Support for `--model` flag in OpenCode server instances.
- Persistent storage for channel-specific model preferences.

### Fixed
- Fixed a connection timeout issue where the bot failed to connect to the internal `opencode serve` process.
- Added `--hostname 0.0.0.0` to the `opencode serve` command to ensure the service is reachable.
- Standardized internal communication to use `127.0.0.1` instead of `localhost` to avoid IPv6 resolution conflicts on some systems.
- Improved process exit handling in `serveManager` to ensure cleaner state management.
- Fixed `DiscordAPIError[40060]` (Interaction already acknowledged) by adding safety checks and better error handling in `interactionHandler.ts`.
- Resolved a `TypeError` in `opencode.ts` by adding safety checks for stream message updates.
- Updated all interaction responses to use `MessageFlags.Ephemeral` instead of the deprecated `ephemeral` property to resolve terminal warnings.
