# Seacat Specification Changelog

All notable changes to the Seacat game specification and implementation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **v9d-debug-visualization**: Debug mode for development visualizations
  - Status: Done
  - `DEBUG_MODE` constant in `Constants.ts` to toggle debug visualizations
  - Ship boundary boxes now only shown when `DEBUG_MODE = true`
  - Grabbable point indicators now only shown when `DEBUG_MODE = true`
  - Cleaner production visuals while maintaining debugging capabilities
  - See proposal: `spec/seacat/proposals/v9d-debug-visualization/`

## Prior Changes

All prior changes were tracked in commit history and individual proposal documents.
See `spec/seacat/proposals/` for historical proposals and their implementation details.
