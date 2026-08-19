#!/bin/sh

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

# Renders both pieces of runtime configuration — the nginx server block and the application's
# config.json — from the environment, then hands off to nginx.
#
# ## Why config.json is written whole rather than patched
#
# This script used to write only the two keys it had values for, which silently dropped every
# other key the shipped file carried: `rbacEnabled`, `institutionType`, `developerToolsEnabled`,
# and `allowedApiOrigins`. `ConfigService` merges what it loads over its own defaults, so RBAC
# stayed on and nothing was insecure — but `allowedApiOrigins` backs a release gate and became
# unsettable in a container, and a deployment that had edited config.json into the image lost
# those edits the moment it set an environment variable.
#
# Every key now has a default here, so the file is complete by construction and no key can go
# missing. That is deliberately not a merge: a merge needs a JSON parser, and adding one to the
# image to solve a problem that a full default table solves is the wrong trade.

set -eu

HTML_ROOT=/usr/share/nginx/html
TEMPLATE=/etc/nginx/templates/default.conf.template
RENDERED=/etc/nginx/conf.d/default.conf

# ---------------------------------------------------------------------------------------------
# nginx: where the /api/ proxy forwards to
# ---------------------------------------------------------------------------------------------
#
# FINERACT_API_URL names the *upstream* Fineract, reachable from this container — not from the
# browser. The browser always talks to /api on this origin, which is what lets the Content-
# Security-Policy keep `connect-src 'self'` instead of being widened per deployment.
FINERACT_UPSTREAM="${FINERACT_API_URL:-https://fineract:8443/fineract-provider/api}"
FINERACT_PROXY_SSL_VERIFY="${FINERACT_PROXY_SSL_VERIFY:-off}"
# See the note in nginx.conf.template: Fineract answers 302 to every API call when this says
# anything but https, because it decides its channel requirement from this header and the hop it
# is answering really is TLS.
FINERACT_FORWARDED_PROTO="${FINERACT_FORWARDED_PROTO:-https}"
export FINERACT_UPSTREAM FINERACT_PROXY_SSL_VERIFY FINERACT_FORWARDED_PROTO

# A trailing slash here would double up against the one in `proxy_pass ${FINERACT_UPSTREAM}/`
# and send Fineract `//v1/clients`, which it answers with a 404 that looks like a routing bug.
FINERACT_UPSTREAM="${FINERACT_UPSTREAM%/}"
export FINERACT_UPSTREAM

if [ ! -f "$TEMPLATE" ]; then
  echo "entrypoint: $TEMPLATE is missing; the image was not built from deploy/Dockerfile." >&2
  exit 1
fi

# Only these three names are substituted. Passing the list is what keeps envsubst from eating
# nginx's own runtime variables — $uri, $host, $remote_addr — which must reach the finished file
# intact. Without the list the server block silently loses its routing and its forwarded headers.
envsubst '${FINERACT_UPSTREAM} ${FINERACT_PROXY_SSL_VERIFY} ${FINERACT_FORWARDED_PROTO}' < "$TEMPLATE" > "$RENDERED"

echo "entrypoint: proxying /api/ -> ${FINERACT_UPSTREAM} (proxy_ssl_verify ${FINERACT_PROXY_SSL_VERIFY}, X-Forwarded-Proto ${FINERACT_FORWARDED_PROTO})"

# ---------------------------------------------------------------------------------------------
# The application's runtime configuration
# ---------------------------------------------------------------------------------------------
#
# fineractApiUrl is same-origin on purpose and is not taken from the environment: pointing it
# elsewhere would need both a CSP change and an allowedApiOrigins entry, which is a deployment
# decision to make by editing this file's output deliberately, not one to fall into by setting a
# variable.
FINERACT_UI_TENANT="${DEFAULT_TENANT:-default}"
FINERACT_UI_RBAC="${RBAC_ENABLED:-true}"
FINERACT_UI_INSTITUTION="${INSTITUTION_TYPE:-universal}"
FINERACT_UI_DEVTOOLS="${DEVELOPER_TOOLS_ENABLED:-false}"

# Rejected rather than coerced. `RBAC_ENABLED=0` or `=no` would otherwise land in the JSON as a
# string, which is truthy, and a deployment that believed it had turned RBAC off would have it on.
# Failing to start is the only outcome that cannot be misread.
for pair in "RBAC_ENABLED:$FINERACT_UI_RBAC" "DEVELOPER_TOOLS_ENABLED:$FINERACT_UI_DEVTOOLS"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  if [ "$value" != "true" ] && [ "$value" != "false" ]; then
    echo "entrypoint: $name must be exactly 'true' or 'false', got '$value'." >&2
    exit 1
  fi
done

cat > "$HTML_ROOT/config.json" <<EOF
{
  "fineractApiUrl": "/api/v1",
  "defaultTenant": "$FINERACT_UI_TENANT",
  "rbacEnabled": $FINERACT_UI_RBAC,
  "institutionType": "$FINERACT_UI_INSTITUTION",
  "developerToolsEnabled": $FINERACT_UI_DEVTOOLS
}
EOF

echo "entrypoint: tenant ${FINERACT_UI_TENANT}, rbacEnabled ${FINERACT_UI_RBAC}, developerTools ${FINERACT_UI_DEVTOOLS}"

exec "$@"
