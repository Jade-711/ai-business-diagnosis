#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
node "$project_root/scripts/repair-action-mappings.mjs"
node "$project_root/scripts/repair-video-exposure-fixtures.mjs"
node "$project_root/scripts/repair-business-demo-fixtures.mjs"
node "$project_root/scripts/audit-business-frameworks.mjs"
node "$project_root/scripts/build-demo-catalog.mjs"
node "$project_root/workflow/build-primary.mjs"
node "$project_root/scripts/build-assets.mjs"
