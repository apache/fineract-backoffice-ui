#!/usr/bin/env bash
#
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
#
# Brings up Fineract with two-factor authentication switched on, plus a mail catcher to read the
# one-time token from.
#
#   bash scripts/e2e-stack-2fa.sh [--fresh]
#
# Deliberately a separate stack from scripts/e2e-stack.sh. `fineract.security.2fa.enabled` is
# process-wide: with it on, every endpoint except /v1/twofactor answers 403 until a token has been
# validated, so the ordinary suite cannot run against this and this cannot run against that.

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f deploy/docker-compose-e2e.yml -f deploy/docker-compose-e2e-2fa.yml)
API="https://localhost:8443/fineract-provider/api/v1"
TENANT_HEADER="Fineract-Platform-TenantId: default"

if [[ "${1:-}" == "--fresh" ]]; then
  echo "Removing volumes for a clean start..."
  "${COMPOSE[@]}" down -v
fi

echo "Starting the database..."
"${COMPOSE[@]}" up -d --wait fineract-db

echo "Seeding tenants..."
docker exec -i fineract-db psql -U postgres < deploy/init-db.sql >/dev/null 2>&1 || true

echo "Starting Fineract with two-factor authentication and the mail catcher..."
"${COMPOSE[@]}" up -d fineract-backend mailpit

echo "Waiting for Fineract (migrations take 60-90s on a fresh volume)..."
for _ in $(seq 1 60); do
  # /v1/twofactor is the one endpoint a Basic credential opens before a second factor exists,
  # so it answering 200 is the signal that both the platform and the feature are up.
  if [[ "$(curl -sk -o /dev/null -w '%{http_code}' -u mifos:password -H "$TENANT_HEADER" "$API/twofactor" || true)" == "200" ]]; then
    break
  fi
  sleep 5
done

if [[ "$(curl -sk -o /dev/null -w '%{http_code}' -u mifos:password -H "$TENANT_HEADER" "$API/twofactor" || true)" != "200" ]]; then
  echo "::error::Fineract did not come up with two-factor authentication enabled."
  "${COMPOSE[@]}" logs --tail=50 fineract-backend
  exit 1
fi

# Point Fineract's SMTP settings at the catcher. The seeded values seed to localhost:3025, which
# is nothing, and a failed send means no token is issued at all rather than an undelivered one.
echo "Pointing SMTP at the mail catcher..."
docker exec -i fineract-db psql -U postgres -d fineract_default >/dev/null <<'SQL'
UPDATE c_external_service_properties SET value = 'mailpit'
  WHERE name = 'host' AND external_service_id = (SELECT id FROM c_external_service WHERE name = 'SMTP_Email_Account');
UPDATE c_external_service_properties SET value = '1025'
  WHERE name = 'port' AND external_service_id = (SELECT id FROM c_external_service WHERE name = 'SMTP_Email_Account');
UPDATE c_external_service_properties SET value = 'false'
  WHERE name = 'useTLS' AND external_service_id = (SELECT id FROM c_external_service WHERE name = 'SMTP_Email_Account');
SQL

echo "✅ Two-factor stack is up. Run: npm run test:e2e:2fa"
