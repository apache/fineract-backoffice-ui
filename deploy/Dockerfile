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

# Both bases are pinned by digest, not by tag. A tag moves; a release image that cannot be
# rebuilt from its own Dockerfile a year later is not much of a release artifact, and the SBOM
# published beside it would describe a build nobody can reproduce. The tag is kept in the comment
# so a human can see what the digest was when it was pinned.

# ---------------------------------------------------------------------------------------------
# Stage 1 — build the Angular application
# ---------------------------------------------------------------------------------------------
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build

WORKDIR /app

COPY package.json package-lock.json ./

# `npm ci`, not `npm install`. `install` is free to resolve a transitive dependency to a version
# the lockfile does not name, so the image would not be reproducible from the lockfile the SBOM
# and the licence scan both describe. CI has a whole job (Dependency Integrity) enforcing this for
# the build; the image had been exempt from it, which is the one place it matters most.
RUN npm ci

COPY . .

RUN npm run build -- --configuration production

# ---------------------------------------------------------------------------------------------
# Stage 2 — serve it
# ---------------------------------------------------------------------------------------------
FROM nginx:stable-alpine@sha256:97d490c12ba55b4946b01546d1c3ed324e8d41ab1c9fcb2a616aa470620e5b46

# Only the built output crosses the stage boundary: no node_modules, no sources, no git history.
COPY --from=build /app/dist/fineract-backoffice-ui/browser /usr/share/nginx/html

# A template rather than a finished config. The upstream Fineract is not known until the container
# starts, and the whole point of the proxy is that the browser only ever talks to this origin.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

# Answers from nginx itself, so it reports whether *this* container is serving — not whether
# Fineract is up, which is a different question with a different answer and its own healthcheck.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/index.html || exit 1

ENTRYPOINT ["/entrypoint.sh"]

CMD ["nginx", "-g", "daemon off;"]
