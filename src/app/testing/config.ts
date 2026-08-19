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

import { Provider, computed, signal } from '@angular/core';
import { AppConfig, ConfigService } from '../core/services/config.service';

/**
 * Defaults matching `public/config.json`, so a spec states only what it is varying.
 */
const TEST_CONFIG: AppConfig = {
  fineractApiUrl: '/api/v1',
  defaultTenant: 'default',
  rbacEnabled: true,
  institutionType: 'universal',
  developerToolsEnabled: false,
};

/**
 * Provides a `ConfigService` whose configuration is fixed for the test.
 *
 * Runtime configuration used to be `environment.rbacEnabled`, a module-level constant, which
 * specs had to mutate and restore in `afterEach` — one thrown assertion before the restore
 * and every later spec in the run saw the wrong value. Configuration is now a signal, so a
 * test states it and it belongs to that TestBed alone.
 */
/** Same rule as `ConfigService`: relative is same-origin, absolute must be this origin or listed. */
function isAllowedInTest(url: string, allowedOrigins: readonly string[]): boolean {
  const candidate = (url ?? '').trim();
  if (!candidate) return false;
  if (!/^https?:\/\//i.test(candidate)) return true;
  try {
    const target = new URL(candidate);
    if (target.origin === window.location.origin) return true;
    return allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === target.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function provideTestConfig(overrides: Partial<AppConfig> = {}): Provider {
  const config = signal<AppConfig>({ ...TEST_CONFIG, ...overrides });

  return {
    provide: ConfigService,
    useValue: {
      config: config.asReadonly(),
      rbacEnabled: computed(() => config().rbacEnabled),
      // Same defaulting as the real service: absent means off, so a spec that does not mention
      // developer tools gets the production behaviour.
      developerToolsEnabled: computed(() => config().developerToolsEnabled === true),
      hiddenNavKeys: computed(() => new Set(config().nav?.hidden)),
      get apiUrl() {
        return config().fineractApiUrl;
      },
      // Mirrors the real service's allow-list, so a spec cannot pass by setting an endpoint the
      // application would refuse.
      isAllowedApiUrl: (url: string) => isAllowedInTest(url, config().allowedApiOrigins ?? []),
      setApiUrl: (url: string) => {
        if (!isAllowedInTest(url, config().allowedApiOrigins ?? [])) return false;
        config.update((c) => ({ ...c, fineractApiUrl: url }));
        return true;
      },
      loadConfig: () => Promise.resolve(),
    } satisfies Partial<ConfigService>,
  };
}
