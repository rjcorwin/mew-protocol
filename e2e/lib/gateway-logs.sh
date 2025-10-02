#!/usr/bin/env bash
# Shared helpers for working with MEW gateway envelope and capability logs

set -euo pipefail

_escape_regex() {
  # Escape characters that are special in basic regular expressions
  printf '%s' "$1" | sed 's/[][\\.^$*+?(){}|]/\\&/g'
}

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

  local escaped_id
  local escaped_participant
  escaped_id="$(_escape_regex "${envelope_id}")"
  escaped_participant="$(_escape_regex "${participant}")"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  grep -E -q "\"event\":\"delivered\".*\"id\":\"${escaped_id}\".*\"participant\":\"${escaped_participant}\"" "${log_file}"
}

assert_capability_granted() {
  local participant="$1"
  local capability="$2"
  local envelope_id="${3:-}"
  local log_file
  log_file="$(_gateway_capability_decisions)"

  local escaped_participant
  local escaped_capability
  local escaped_envelope
  escaped_participant="$(_escape_regex "${participant}")"
  escaped_capability="$(_escape_regex "${capability}")"
  escaped_envelope="$(_escape_regex "${envelope_id}")"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    local jq_filter
    jq_filter=".participant == \"${participant}\" and .result == \"allowed\" and .required_capability == \"${capability}\""
    if [[ -n "${envelope_id}" ]]; then
      jq_filter="${jq_filter} and .envelope_id == \"${envelope_id}\""
    fi
    jq -e "select(${jq_filter})" "${log_file}" > /dev/null
  else
    local pattern
    pattern="\"participant\":\"${escaped_participant}\".*\"result\":\"allowed\".*\"required_capability\":\"${escaped_capability}\""
    if [[ -n "${envelope_id}" ]]; then
      pattern="${pattern}.*\"envelope_id\":\"${escaped_envelope}\""
    fi
    grep -E -q "${pattern}" "${log_file}"
  fi
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
  local envelope_id="${3:-}"

  for _ in {1..300}; do
    if assert_capability_granted "${participant}" "${capability}" "${envelope_id}"; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

assert_envelope_received() {
  local envelope_id="$1"
  local participant="${2:-}"
  local log_file
  log_file="$(_gateway_envelope_history)"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  local escaped_id
  escaped_id="$(_escape_regex "${envelope_id}")"
  local pattern
  pattern="\"event\":\"received\".*\"id\":\"${escaped_id}\""

  if [[ -n "${participant}" ]]; then
    local escaped_participant
    escaped_participant="$(_escape_regex "${participant}")"
    pattern="${pattern}.*\"participant\":\"${escaped_participant}\""
  fi

  grep -E -q "${pattern}" "${log_file}"
}

wait_for_envelope_receipt() {
  local envelope_id="$1"
  local participant="${2:-}"

  for _ in {1..300}; do
    if assert_envelope_received "${envelope_id}" "${participant}"; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

assert_envelope_rejected() {
  local envelope_id="$1"
  local participant="${2:-}"
  local reason="${3:-}"
  local log_file
  log_file="$(_gateway_envelope_history)"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  local escaped_id
  escaped_id="$(_escape_regex "${envelope_id}")"
  local pattern
  pattern="\"event\":\"rejected\".*\"id\":\"${escaped_id}\""

  if [[ -n "${participant}" ]]; then
    local escaped_participant
    escaped_participant="$(_escape_regex "${participant}")"
    pattern="${pattern}.*\"participant\":\"${escaped_participant}\""
  fi

  if [[ -n "${reason}" ]]; then
    local escaped_reason
    escaped_reason="$(_escape_regex "${reason}")"
    pattern="${pattern}.*\"reason\":\"${escaped_reason}\""
  fi

  grep -E -q "${pattern}" "${log_file}"
}

wait_for_envelope_rejection() {
  local envelope_id="$1"
  local participant="${2:-}"
  local reason="${3:-}"

  for _ in {1..300}; do
    if assert_envelope_rejected "${envelope_id}" "${participant}" "${reason}"; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

wait_for_capability_decision() {
  local participant="$1"
  local capability="$2"
  local result="${3:-allowed}"
  local envelope_id="${4:-}"
  local log_file
  log_file="$(_gateway_capability_decisions)"

  if [[ ! -f "${log_file}" ]]; then
    return 1
  fi

  for _ in {1..300}; do
    if command -v jq >/dev/null 2>&1; then
      local jq_filter
      jq_filter=".participant == \"${participant}\" and .required_capability == \"${capability}\" and .result == \"${result}\""
      if [[ -n "${envelope_id}" ]]; then
        jq_filter="${jq_filter} and .envelope_id == \"${envelope_id}\""
      fi
      if jq -e "select(${jq_filter})" "${log_file}" > /dev/null; then
        return 0
      fi
    else
      local escaped_participant
      local escaped_capability
      local escaped_result
      local escaped_envelope
      escaped_participant="$(_escape_regex "${participant}")"
      escaped_capability="$(_escape_regex "${capability}")"
      escaped_result="$(_escape_regex "${result}")"
      escaped_envelope="$(_escape_regex "${envelope_id}")"

      local pattern
      pattern="\"participant\":\"${escaped_participant}\".*\"required_capability\":\"${escaped_capability}\".*\"result\":\"${escaped_result}\""
      if [[ -n "${envelope_id}" ]]; then
        pattern="${pattern}.*\"envelope_id\":\"${escaped_envelope}\""
      fi

      if grep -E -q "${pattern}" "${log_file}"; then
        return 0
      fi
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
