#!/usr/bin/env bash
# Ensure the local packages/mew CLI is built and linked for tests

set -euo pipefail

ensure_mew_cli() {
  if [[ -n "${MEW_TESTS_CLI_READY:-}" ]]; then
    return 0
  fi

  local repo_root
  if [[ -n "${REPO_ROOT:-}" ]]; then
    repo_root="${REPO_ROOT}"
  elif [[ -n "${SCENARIO_DIR:-}" ]]; then
    repo_root="$(cd "${SCENARIO_DIR}/../.." && pwd)"
  else
    repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  fi

  local mew_pkg="${repo_root}/packages/mew"
  local cache_dir="${repo_root}/tests/.cache"
  if [[ ! -d "${mew_pkg}" ]]; then
    echo "packages/mew not found under ${repo_root}" >&2
    return 1
  fi

  mkdir -p "${cache_dir}"

  local npm_prefix_global
  npm_prefix_global="$(npm prefix -g)"
  local npm_bin_global="${npm_prefix_global}/bin"
  if [[ -n "${npm_bin_global}" && ":${PATH}:" != *":${npm_bin_global}:"* ]]; then
    PATH="${npm_bin_global}:${PATH}"
    export PATH
  fi

  local build_stamp="${cache_dir}/mew-cli-build.stamp"
  local needs_build=false
  if [[ ! -d "${mew_pkg}/dist" ]]; then
    needs_build=true
  elif [[ ! -f "${build_stamp}" ]]; then
    needs_build=true
  else
    local newer_src
    newer_src="$(find "${mew_pkg}/src" -type f -newer "${build_stamp}" -print -quit)"
    if [[ -n "${newer_src}" ]]; then
      needs_build=true
    fi
  fi

  pushd "${mew_pkg}" >/dev/null

  if [[ ! -d "node_modules" ]]; then
    npm install >/dev/null 2>&1
  fi

  if [[ "${needs_build}" == true ]]; then
    npm run build:all >/dev/null 2>&1
    touch "${build_stamp}"
  fi

  popd >/dev/null

  local npm_root_global
  npm_root_global="$(npm root -g)"
  local global_link="${npm_root_global}/@mew-protocol/mew"
  local needs_link=true
  if [[ -e "${global_link}" ]]; then
    local resolved
    resolved="$(readlink -f "${global_link}" 2>/dev/null || realpath "${global_link}" 2>/dev/null || echo "")"
    if [[ "${resolved}" == "${mew_pkg}" ]]; then
      needs_link=false
    fi
  fi

  if [[ "${needs_link}" == true ]]; then
    pushd "${mew_pkg}" >/dev/null
    npm link >/dev/null 2>&1
    popd >/dev/null
  fi

  if ! command -v mew >/dev/null 2>&1; then
    echo "mew CLI not available on PATH even after linking" >&2
    return 1
  fi

  export MEW_TESTS_CLI_READY=1
  return 0
}
