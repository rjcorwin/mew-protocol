#!/usr/bin/env bash
# Shared helpers for working with MEW gateway envelope and capability logs

set -euo pipefail

_gateway_log_dir() {
  if [[ -n "${GATEWAY_LOG_DIR:-}" ]]; then
    printf '%s' "${GATEWAY_LOG_DIR}"
    return
  fi

  if [[ -n "${WORKSPACE_DIR:-}" ]]; then
    printf '%s' "${WORKSPACE_DIR}/.mew/logs"
    return
  fi

  printf '%s' ".mew/logs"
}

_gateway_envelope_history() {
  printf '%s' "$(_gateway_log_dir)/envelope-history.jsonl"
}

_gateway_capability_decisions() {
  printf '%s' "$(_gateway_log_dir)/capability-decisions.jsonl"
}

wait_for_envelope() {
  local envelope_id="$1"
  local log_file
  log_file="$(_gateway_envelope_history)"

  for _ in {1..300}; do
    if [[ -f "${log_file}" ]] && grep -F -q "\"id\":\"${envelope_id}\"" "${log_file}"; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

assert_envelope_delivered() {
  local envelope_id="$1"
  local participant="$2"
  local log_file
  log_file="$(_gateway_envelope_history)"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  grep -q "\"event\":\"delivered\".*\"id\":\"${envelope_id}\".*\"participant\":\"${participant}\"" "${log_file}"
}

assert_capability_granted() {
  local participant="$1"
  local capability="$2"
  local log_file
  log_file="$(_gateway_capability_decisions)"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  grep -q "\"participant\":\"${participant}\".*\"result\":\"allowed\".*\"required_capability\":\"${capability}\"" "${log_file}"
}

wait_for_delivery() {
  local envelope_id="$1"
  local participant="$2"

  for _ in {1..300}; do
    if assert_envelope_delivered "${envelope_id}" "${participant}"; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

wait_for_capability_grant() {
  local participant="$1"
  local capability="$2"

  for _ in {1..300}; do
    if assert_capability_granted "${participant}" "${capability}"; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

get_envelope_routing_decision() {
  local envelope_id="$1"
  local log_file
  log_file="$(_gateway_capability_decisions)"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -c "select(.envelope_id == \"${envelope_id}\" and .event == \"routing_decision\")" "${log_file}"
  else
    grep -F "\"envelope_id\":\"${envelope_id}\"" "${log_file}" || true
  fi
}

generate_envelope_id() {
  date +"env-%s%N-$RANDOM"
}
