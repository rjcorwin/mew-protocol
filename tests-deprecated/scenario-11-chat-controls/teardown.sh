#!/bin/bash
# Teardown script for Scenario 11 - Chat & Reasoning Controls

set -e

../../cli/bin/mew.js space down --force >/dev/null 2>&1 || true
rm -f .mew/pids.json 2>/dev/null || true
