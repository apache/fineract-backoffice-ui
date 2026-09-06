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
# ## config.json belongs to this script. Deployments must not edit it.
#
# This file is written whole on every container start, from the environment and nothing else.
# Any key it does not emit is therefore *erased* at startup, whatever the image contained.
#
# That used to be a trap. An earlier revision of this comment claimed "every key now has a
# default here, so the file is complete by construction and no key can go missing" — but the
# heredoc below emits five keys, and `allowedApiOrigins`, `institutionFeatures` and `nav` were
# added to `AppConfig` afterwards. A deployment that baked any of those into the image lost them
# silently on the next restart, `allowedApiOrigins` included, which backs a security control.
#
# The fix is not to keep this table in step with `AppConfig` forever — that is a race this script
# will keep losing. It is that a deployment has its own file now:
#
#     branding/config.json
#
# read by `ConfigService` after this one and merged over it, never written by this script or by
# upstream, and absent by default. Everything a deployment wants to set goes there. See
# DOCS/CUSTOMIZATION.md.
#
# So the rule for this heredoc is narrow: it carries only what the *container environment* is the
# right source for. Adding an `AppConfig` key here is almost always the wrong move.

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

# Whether this image carries a branding overlay, which is a fact about the container's own
# filesystem and so exactly what this heredoc is for — the deployer already declared it by
# doing the `COPY branding/ ...` in DOCS/CUSTOMIZATION.md, and should not have to say it twice.
#
# The app cannot work this out for itself. Asking for a file that is absent on every default
# install put a 404 in the browser console on every page load, and a 404 is a network-level
# event the application can decline to report but cannot suppress.
if [ -d "$HTML_ROOT/branding" ]; then
  FINERACT_UI_BRANDING=true
else
  FINERACT_UI_BRANDING=false
fi

cat > "$HTML_ROOT/config.json" <<EOF
{
  "fineractApiUrl": "/api/v1",
  "defaultTenant": "$FINERACT_UI_TENANT",
  "rbacEnabled": $FINERACT_UI_RBAC,
  "institutionType": "$FINERACT_UI_INSTITUTION",
  "developerToolsEnabled": $FINERACT_UI_DEVTOOLS,
  "brandingOverlayEnabled": $FINERACT_UI_BRANDING
}
EOF

echo "entrypoint: tenant ${FINERACT_UI_TENANT}, rbacEnabled ${FINERACT_UI_RBAC}, developerTools ${FINERACT_UI_DEVTOOLS}, brandingOverlay ${FINERACT_UI_BRANDING}"

exec "$@"
