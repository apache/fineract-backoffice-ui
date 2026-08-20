#!/bin/bash

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# Usage: ./scripts/verify-signed-commits.sh [--base-ref <ref>] [--head-ref <ref>] [--strict] [--help]
set -e

BASE_REF="origin/main"
HEAD_REF="HEAD"
STRICT_MODE=false

show_help() {
    cat << 'EOF'
Usage: ./scripts/verify-signed-commits.sh [OPTIONS]

Options:
  --base-ref <ref>   Base reference (default: origin/main)
  --head-ref <ref>   Head reference (default: HEAD)
  --strict           Exit with error if unsigned commits found
  --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --base-ref) BASE_REF="$2"; shift 2 ;;
        --head-ref) HEAD_REF="$2"; shift 2 ;;
        --strict) STRICT_MODE=true; shift ;;
        --help) show_help; exit 0 ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

MERGE_BASE=$(git merge-base "$BASE_REF" "$HEAD_REF" 2>/dev/null || echo "")
if [ -z "$MERGE_BASE" ]; then
    COMMIT_RANGE="$HEAD_REF~10..$HEAD_REF"
else
    COMMIT_RANGE="$MERGE_BASE..$HEAD_REF"
fi

echo "Verifying commit signatures in range: $COMMIT_RANGE"

COMMITS=$(git log --format="%H%x1f%G?%x1f%an%x1f%s" "$COMMIT_RANGE" 2>/dev/null || echo "")
if [ -z "$COMMITS" ]; then
    echo "No commits to verify."
    exit 0
fi

UNSIGNED_COUNT=0

# A commit is signed when git reports any %G? other than N, OR when the object
# carries a gpgsig / gpgsig-sha256 header. The second check is required for SSH
# signatures: GitHub Actions runners have no gpg.ssh.allowedSignersFile, and git
# then reports SSH-signed commits as N even though the payload is on the object.
# Validity of the key is GitHub's job (Verified badge), not this script's.
commit_has_signature_payload() {
    git cat-file -p "$1" | grep -E -q '^(gpgsig|gpgsig-sha256) '
}

while IFS=$'\x1f' read -r HASH SIG_STATUS AUTHOR SUBJECT; do
    [ -z "$HASH" ] && continue
    SHORT_HASH="${HASH:0:7}"

    signed=false
    case "$SIG_STATUS" in
        N)
            if commit_has_signature_payload "$HASH"; then
                signed=true
            fi
            ;;
        *)
            signed=true
            ;;
    esac

    if [ "$signed" = true ]; then
        echo "✅ Signed: $SHORT_HASH - $SUBJECT"
    else
        UNSIGNED_COUNT=$((UNSIGNED_COUNT + 1))
        if [ -n "$GITHUB_ACTIONS" ]; then
            echo "::error title=Unsigned Commit::Commit $SHORT_HASH by $AUTHOR is not signed."
        else
            echo "❌ Unsigned: $SHORT_HASH - $SUBJECT ($AUTHOR)"
        fi
    fi
done <<< "$COMMITS"

echo ""
echo "Summary: $UNSIGNED_COUNT unsigned commit(s) found."

if [ "$STRICT_MODE" = true ] && [ "$UNSIGNED_COUNT" -gt 0 ]; then
    if [ -n "$GITHUB_ACTIONS" ]; then
        echo "::error::$UNSIGNED_COUNT unsigned commit(s). See CONTRIBUTING.md#commit-signing"
    else
        echo "❌ $UNSIGNED_COUNT unsigned commit(s). See CONTRIBUTING.md#commit-signing"
    fi
    exit 1
fi

exit 0
