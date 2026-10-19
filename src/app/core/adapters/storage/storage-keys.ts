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

/**
 * The key inventory, in its own file so both the contract and the Web Storage implementation
 * can read it as a value without the two importing each other at runtime.
 */

/**
 * How long a stored value survives.
 *
 * `session` is scoped to the browser tab and cleared when it closes; `device` persists across
 * restarts and is shared by every tab of the origin. The names describe the lifetime the
 * caller wants rather than the Web Storage API that currently provides it — a caller should
 * be choosing "until this tab closes", not choosing `sessionStorage`.
 */
export type StorageScope = 'session' | 'device';

/**
 * The keys this application stores, and the scope each belongs to.
 *
 * Enumerating them is the point. `security.md` §4 treats web storage as a trust boundary, and
 * a boundary nobody can list is one nobody can review: before this, `logout()` cleared the
 * session key and left `fineract_runtime_config` — the API endpoint every subsequent request
 * and every subsequent set of credentials goes to — in place across sign-outs, because no
 * single place knew that key existed. A closed set makes `clearScope` possible, and makes an
 * unlisted key a compile error rather than a discovery.
 *
 * `AGENTS.md` requires `fineract_`-prefixed snake_case keys; the literals below are the
 * enforcement of that rule, not a restatement of it — `theme` was previously stored under a
 * bare `'theme'`, which the rule forbids. No migration shim reads the old key: the cost of
 * the rename is that each existing user's theme falls back to their OS preference once, which
 * `ThemeService` already handles as the no-value case.
 */
export const STORAGE_KEYS = {
  /** The authenticated session, including the Basic auth key. Tab-scoped, never persisted. */
  session: { key: 'fineract_session', scope: 'session' },
  /** The OIDC tokens of the signed-in user. Tab-scoped, never persisted. */
  oidcTokens: { key: 'fineract_oidc_tokens', scope: 'session' },
  /** The state, nonce and PKCE verifier of a sign-in in progress. Tab-scoped. */
  oidcFlow: { key: 'fineract_oidc_flow', scope: 'session' },
  /** The active Fineract tenant. */
  tenant: { key: 'fineract_tenant', scope: 'device' },
  /** The user's API-endpoint override. See `ConfigService`. */
  runtimeConfig: { key: 'fineract_runtime_config', scope: 'device' },
  /** The institution type driving group-lending feature visibility. */
  institutionType: { key: 'fineract_institution_type', scope: 'device' },
  /** Light or dark theme. */
  theme: { key: 'fineract_theme', scope: 'device' },
} as const satisfies Record<string, { key: string; scope: StorageScope }>;

/** A key the application is allowed to store. */
export type StorageKey = keyof typeof STORAGE_KEYS;
