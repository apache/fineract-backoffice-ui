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

# Prints Fineract's permission catalogue, for scripts/snapshot-permission-codes.mjs to normalise.
#
#   bash scripts/fetch-permission-codes.sh | node scripts/snapshot-permission-codes.mjs
#
# Which is what `npm run permissions:snapshot` runs.
#
# `-k` because the e2e container serves the self-signed certificate it generates for itself --
# deploy/docker-compose-e2e.yml publishes 8443 only, and there is no CA to validate it against.
# e2e-stack.sh already does the same against the same host for its health probe. Keeping the
# fetch here rather than in Node is what lets the normaliser do no I/O at all: see its header.
#
# Point FINERACT_BACKEND_ORIGIN at another instance and supply FINERACT_CA_CERT to validate
# properly; with a CA set, -k is dropped.

set -euo pipefail

ORIGIN="${FINERACT_BACKEND_ORIGIN:-https://localhost:8443}"
TENANT="${FINERACT_TENANT_ID:-default}"
USERNAME="${FINERACT_USERNAME:-mifos}"
PASSWORD="${FINERACT_PASSWORD:-password}"

if [[ -n "${FINERACT_CA_CERT:-}" ]]; then
  TLS_ARGS=(--cacert "$FINERACT_CA_CERT")
else
  TLS_ARGS=(-k)
fi

curl --fail --silent --show-error --max-time 30 \
  "${TLS_ARGS[@]}" \
  -u "$USERNAME:$PASSWORD" \
  -H "Fineract-Platform-TenantId: $TENANT" \
  "$ORIGIN/fineract-provider/api/v1/permissions"
