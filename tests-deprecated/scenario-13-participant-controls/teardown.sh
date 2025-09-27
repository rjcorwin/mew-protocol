#!/bin/bash
# Teardown script for Scenario 13 - Participant Lifecycle Controls

set -e

../../cli/bin/mew.js space down --force >/dev/null 2>&1 || true
rm -f .mew/pids.json 2>/dev/null || true
