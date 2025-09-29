#!/bin/bash
# Teardown script for Scenario 12 - Stream Lifecycle Controls

set -e

../../packages/mew/src/bin/mew.js space down --force >/dev/null 2>&1 || true
rm -f .mew/pids.json 2>/dev/null || true
