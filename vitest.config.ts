/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { defineConfig } from 'vitest/config';

/**
 * Runner configuration merged into the one `@angular/build:unit-test` generates.
 *
 * The single reason this file exists: `@ionic/angular` reaches `@ionic/core/components` as a
 * *directory* import, which Node's ESM resolver rejects outright. Vitest externalises the
 * package by default and hands it to Node, so every Ionic-touching spec fails to load with
 * "Directory import ... is not supported".
 *
 * Inlining the package puts resolution back in Vite's hands, where the directory import is
 * understood. This is a property of how Ionic ships, not of any spec, so it belongs in the
 * runner config rather than in a per-spec workaround.
 */
export default defineConfig({
  test: {
    /**
     * Vitest's 5s default is a poor fit for Angular TestBed. The first `createComponent()` in a
     * file compiles the component and everything it imports, which for the larger screens runs
     * past 5s on a cold Vite cache even though the test body itself is synchronous — so a spec
     * passes locally on a warm re-run and fails in CI, which is always cold. The cost is paid
     * once per file, not per test, so a higher ceiling costs nothing on the passing path.
     */
    testTimeout: 30_000,
    /** Angular TestBed compilation happens in async hooks and needs the same cold-start budget. */
    hookTimeout: 30_000,
    /** Avoid Vitest's interactive terminal redraw, which can fail with `write UNKNOWN` on Windows. */
    reporters: ['minimal'],
    server: {
      deps: {
        inline: [/@ionic\/angular/, /@ionic\/core/],
      },
    },
  },
});
