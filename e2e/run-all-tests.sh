#!/usr/bin/env bash
# MEW integration test runner compatible with the draft tests specification

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "${SCRIPT_DIR}")"

NO_LLM=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-llm)
      NO_LLM=true
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help)
      cat <<"HELP"
Usage: $0 [--no-llm] [--verbose|-v] [--help]

Options:
  --no-llm       Skip scenarios that require external LLM access
  --verbose|-v   Stream scenario output while running
  --help         Show this help message
HELP
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${BLUE}================================================${NC}"
printf "%b\n" "${BLUE}        MEW Test Suite Runner (Draft)          ${NC}"
printf "%b\n" "${BLUE}================================================${NC}"
if [[ ${NO_LLM} == true ]]; then
  printf "%b\n" "${YELLOW}        LLM scenarios disabled (--no-llm)      ${NC}"
  printf "%b\n" "${BLUE}================================================${NC}"
fi
if [[ ${VERBOSE} == true ]]; then
  printf "%b\n" "${YELLOW}        Verbose mode enabled                   ${NC}"
  printf "%b\n" "${BLUE}================================================${NC}"
fi
printf "\n"

# Build and install globally for PM2 scenarios
printf "%b\n" "${YELLOW}Building and installing mew globally...${NC}"
if ! (cd "${REPO_ROOT}" && npm run build > /dev/null 2>&1); then
  printf "%b\n" "${RED}❌ Build failed${NC}"
  exit 1
fi
if ! (cd "${REPO_ROOT}" && npm install -g . > /dev/null 2>&1); then
  printf "%b\n" "${RED}❌ Global install failed${NC}"
  exit 1
fi
printf "%b\n" "${GREEN}✓ mew installed globally${NC}"
printf "\n"

declare -i TOTAL_PASS=0
declare -i TOTAL_FAIL=0
FAILED_TESTS=""

TEST_RESULTS_LOG="${REPO_ROOT}/test-results.log"
{
  printf "MEW Test Suite Results - %s\n" "$(date)"
  printf "================================================\n"
} > "${TEST_RESULTS_LOG}"

format_display_name() {
  local dir_name="$1"
  local base="${dir_name#scenario-}"
  local number="${base%%-*}"
  local rest="${base#${number}-}"
  if [[ "${rest}" == "${base}" ]]; then
    rest="${base}"
  fi
  rest=${rest//-/ }
  rest=$(echo "${rest}" | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2)} print}')
  if [[ -n "${number}" && "${number}" != "${base}" ]]; then
    echo "Scenario ${number}: ${rest}"
  else
    local alt=${dir_name//-/ }
    alt=$(echo "${alt}" | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2)} print}')
    echo "${alt}"
  fi
}

SCENARIO_DIRS=()
while IFS= read -r scenario_dir; do
  SCENARIO_DIRS+=("${scenario_dir}")
done < <(find "${SCRIPT_DIR}" -maxdepth 1 -mindepth 1 -type d -name 'scenario-*' | sort)

if [[ ${#SCENARIO_DIRS[@]} -eq 0 ]]; then
  echo "No scenarios found under ${SCRIPT_DIR}" >&2
  exit 1
fi

run_test() {
  local display_name="$1"
  local dir="$2"
  local requires_llm="$3"

  if [[ ${NO_LLM} == true && ${requires_llm} == true ]]; then
    printf "%b\n" "${YELLOW}Skipping ${display_name} - requires LLM access${NC}"
    return
  fi

  printf "%b\n" "${YELLOW}Running ${display_name}...${NC}"
  {
    printf "\n[%s]\n" "${display_name}"
  } >> "${TEST_RESULTS_LOG}"

  pushd "${dir}" >/dev/null || {
    printf "%b\n" "${RED}❌ ${display_name} directory missing${NC}"
    TOTAL_FAIL+=1
    if [[ -z "${FAILED_TESTS}" ]]; then
      FAILED_TESTS="  - ${display_name} (directory missing)"
    else
      FAILED_TESTS="${FAILED_TESTS}\n  - ${display_name} (directory missing)"
    fi
    return
  }

  mkdir -p logs

  local log_file="logs/test-output.log"
  local exit_code
  if [[ ${VERBOSE} == true ]]; then
    timeout 120 ./test.sh 2>&1 | tee "${log_file}"
    exit_code=${PIPESTATUS[0]}
  else
    timeout 120 ./test.sh > "${log_file}" 2>&1
    exit_code=$?
  fi

  if [[ ${exit_code} -eq 0 ]]; then
    printf "%b\n" "${GREEN}✅ ${display_name} PASSED${NC}"
    printf "Status: PASSED\n" >> "${TEST_RESULTS_LOG}"
    TOTAL_PASS+=1
  else
    if [[ ${exit_code} -eq 124 ]]; then
      printf "%b\n" "${RED}❌ ${display_name} TIMEOUT${NC}"
      printf "Status: TIMEOUT\n" >> "${TEST_RESULTS_LOG}"
    else
      printf "%b\n" "${RED}❌ ${display_name} FAILED${NC}"
      printf "Status: FAILED (exit code: %s)\n" "${exit_code}" >> "${TEST_RESULTS_LOG}"
    fi
    printf "   See %s for details\n" "${dir}/logs/test-output.log"
    if [[ ${VERBOSE} == true ]]; then
      tail -20 "${log_file}" || true
    fi
    TOTAL_FAIL+=1
    if [[ -z "${FAILED_TESTS}" ]]; then
      FAILED_TESTS="  - ${display_name}"
    else
      FAILED_TESTS="${FAILED_TESTS}\n  - ${display_name}"
    fi
  fi

  popd >/dev/null

  pkill -f "mew.js" 2>/dev/null || true
  pkill -f "pm2.*daemon" 2>/dev/null || true
  pkill -f "mew-bridge" 2>/dev/null || true
  pkill -f "@modelcontextprotocol" 2>/dev/null || true
  sleep 1

  printf "\n"
}

printf "%b\n" "${YELLOW}Cleaning up any existing test processes...${NC}"
pkill -f "mew.js" 2>/dev/null || true
pkill -f "pm2.*daemon" 2>/dev/null || true
pkill -f "mew-bridge" 2>/dev/null || true
pkill -f "@modelcontextprotocol" 2>/dev/null || true
sleep 2

for dir in "${SCENARIO_DIRS[@]}"; do
  scenario_basename="$(basename "${dir}")"
  display_name="$(format_display_name "${scenario_basename}")"
  requires_llm=false
  if [[ -f "${dir}/requires-llm" ]]; then
    requires_llm=true
  fi
  run_test "${display_name}" "${dir}" "${requires_llm}"
done

printf "%b\n" "${BLUE}================================================${NC}"
printf "%b\n" "${BLUE}                 TEST SUMMARY                   ${NC}"
printf "%b\n" "${BLUE}================================================${NC}"
printf "Tests Passed: %d\n" "${TOTAL_PASS}"
printf "Tests Failed: %d\n" "${TOTAL_FAIL}"

{
  printf "\n================================================\n"
  printf "SUMMARY\n"
  printf "Tests Passed: %d\n" "${TOTAL_PASS}"
  printf "Tests Failed: %d\n" "${TOTAL_FAIL}"
  if [[ ${TOTAL_FAIL} -gt 0 ]]; then
    printf "Failures:%s\n" "${FAILED_TESTS}"
  fi
} >> "${TEST_RESULTS_LOG}"

if [[ ${TOTAL_FAIL} -gt 0 ]]; then
  exit 1
fi
