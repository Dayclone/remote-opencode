# Changelog

All notable changes to this project will be documented in this file.

## [1.0.11] - 2026-02-04

### Added
- Model confirmation in Discord messages: The bot now displays which model is being used when starting a session.

### Fixed
- Fixed `--model` flag not being passed to `opencode serve` when a channel model preference was set via `/model set`.
- Fixed instance key to include model, allowing the same project to use different models in different channels.
- Fixed button handlers (Interrupt, Create PR) not respecting channel model preferences.

## [1.0.10] - 2026-02-04

### Added
- New `/setports` slash command to configure the port range for OpenCode server instances.

### Fixed
- Fixed Windows-specific spawning issue where the bot failed to find the `opencode` command (now targeting `opencode.cmd`).
- Resolved `spawn EINVAL` errors on Windows by correctly configuring shell execution.
- Fixed a crash where the bot would attempt to pass an unsupported `--model` flag to `opencode serve`.
- Improved server reliability by extending the ready-check timeout to 30 seconds.
- Suppressed `DEP0190` security warnings in the terminal caused by Windows-specific shell execution requirements.
- Standardized internal communication to use `127.0.0.1` and added real-time process logging (available via `DEBUG` env var).

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
