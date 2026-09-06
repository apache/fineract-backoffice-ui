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

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ConfigService, AppConfig } from './config.service';
import { SKIP_ERROR_TOAST, SKIP_LOADING } from '../http/http-context';

const STORAGE_KEY = 'fineract_runtime_config';

/**
 * Raw storage access, in one place.
 *
 * These specs assert what is *persisted*, so they have to look at the real store rather than the
 * STORAGE adapter the application uses. Funnelling every access through these three helpers keeps
 * that to a single boundary crossing instead of one per assertion.
 */
/* eslint-disable no-restricted-globals */
const storedRaw = (): string | null => localStorage.getItem(STORAGE_KEY);
const storeRaw = (value: unknown): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
const clearStore = (): void => localStorage.clear();
/* eslint-enable no-restricted-globals */
const TEST_TENANT = 'test-tenant';
const CONFIG_FILE = 'config.json';
const OVERLAY_FILE = 'branding/config.json';

/** The upstream layer. Matched narrowly so it cannot also catch the overlay below it. */
const isBaseConfig = (request: { url: string }): boolean =>
  request.url.includes(CONFIG_FILE) && !request.url.includes('branding/');

/** The deployment-owned layer, read after the base and merged over it. */
const isOverlay = (request: { url: string }): boolean => request.url.includes(OVERLAY_FILE);

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;

  const mockConfig: AppConfig = {
    fineractApiUrl: 'https://test-api.com',
    defaultTenant: TEST_TENANT,
    rbacEnabled: true,
    institutionType: 'universal',
  };

  /** Rebuilds the service so its constructor re-reads whatever local storage now holds. */
  function create(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ConfigService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  /**
   * Flushes the next request matching `predicate`, waiting for it to be issued.
   *
   * The two config layers are fetched in sequence, so the second request does not exist until
   * the first has resolved and its continuation has run. Draining the microtask queue is what
   * lets a synchronous `expectOne` see it.
   */
  async function flushNext(
    predicate: (request: { url: string }) => boolean,
    body: Partial<AppConfig> | null,
    opts?: { status: number; statusText: string },
  ): Promise<void> {
    let matched = httpMock.match(predicate);
    for (let attempt = 0; attempt < 50 && matched.length === 0; attempt++) {
      await Promise.resolve();
      matched = httpMock.match(predicate);
    }
    expect(matched.length).toBe(1);
    matched[0].flush(body, opts);
  }

  const NOT_FOUND = { status: 404, statusText: 'Not Found' };

  /**
   * Runs a full load cycle: `body` as config.json, `overlay` as the deployment's own layer.
   *
   * The overlay defaults to absent, which is what almost every deployment serves and therefore
   * the case most of these tests are about. Passing one implies `brandingOverlayEnabled`, since
   * the base layer is what decides whether the overlay is fetched at all — a deployment that
   * ships `branding/` without the flag is covered by its own case below.
   */
  async function load(body: Partial<AppConfig>, overlay?: Partial<AppConfig>): Promise<void> {
    const base = overlay ? { brandingOverlayEnabled: true, ...body } : body;
    const loading = service.loadConfig();
    await flushNext(isBaseConfig, base);
    if (overlay) await flushNext(isOverlay, overlay);
    await loading;
  }

  beforeEach(() => {
    clearStore();
    create();
  });

  afterEach(() => {
    httpMock.verify();
    clearStore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load config from http', async () => {
    await load(mockConfig);

    expect(service.apiUrl).toBe(mockConfig.fineractApiUrl);
    expect(service.config().defaultTenant).toBe(TEST_TENANT);
  });

  it('should keep defaults for keys config.json leaves out', async () => {
    // A deployment writes only what it is changing; the rest must not be blanked out.
    await load({ rbacEnabled: false });

    expect(service.rbacEnabled()).toBe(false);
    expect(service.config().institutionType).toBe('universal');
    expect(service.config().defaultTenant).toBe('default');
  });

  it('should fall back to defaults when config.json cannot be read', async () => {
    const loading = service.loadConfig();
    await flushNext(isBaseConfig, null, NOT_FOUND);
    await loading;

    // Bootstrap must not depend on either file being present.
    expect(service.rbacEnabled()).toBe(true);
    expect(service.config().defaultTenant).toBe('default');
  });

  it('should merge the deployment overlay over config.json', async () => {
    await load(
      { fineractApiUrl: '/api/v1', defaultTenant: TEST_TENANT, rbacEnabled: true },
      { branding: { appName: 'Any Community Bank' }, nav: { hidden: ['spm'] } },
    );

    // The overlay named neither, and must not have discarded them.
    expect(service.apiUrl).toBe('/api/v1');
    expect(service.config().defaultTenant).toBe(TEST_TENANT);

    expect(service.config().branding?.appName).toBe('Any Community Bank');
    expect(service.hiddenNavKeys().has('spm')).toBe(true);
  });

  it('should keep the base layer when the overlay is absent', async () => {
    // The state every existing deployment is in: nothing is asked for, and nothing is reset.
    await load({ fineractApiUrl: '/api/v1', defaultTenant: TEST_TENANT, rbacEnabled: false });

    expect(service.config().defaultTenant).toBe(TEST_TENANT);
    expect(service.rbacEnabled()).toBe(false);
  });

  /**
   * The overlay is absent on every default install, so probing for it reported a 404 in the
   * browser console on every load. The application can decline to *report* a 404 and does, but
   * the browser writes it regardless — the only fix is not to make the request. See #487.
   */
  describe('the branding overlay probe', () => {
    it('is not issued when the deployment has not declared an overlay', async () => {
      const loading = service.loadConfig();
      await flushNext(isBaseConfig, { fineractApiUrl: '/api/v1' });
      await loading;

      // `httpMock.verify()` in afterEach would fail on an outstanding request, but this says
      // what is being asserted rather than relying on a teardown to imply it.
      expect(httpMock.match(isOverlay).length).toBe(0);
    });

    it('is not issued when the deployment declares it off', async () => {
      const loading = service.loadConfig();
      await flushNext(isBaseConfig, { fineractApiUrl: '/api/v1', brandingOverlayEnabled: false });
      await loading;

      expect(httpMock.match(isOverlay).length).toBe(0);
    });

    it('is issued once the deployment declares an overlay', async () => {
      await load(
        { fineractApiUrl: '/api/v1', brandingOverlayEnabled: true },
        { branding: { appName: 'Any Community Bank' } },
      );

      expect(service.config().branding?.appName).toBe('Any Community Bank');
      expect(service.brandingOverlayEnabled()).toBe(true);
    });

    it('still tolerates a declared overlay that is not actually there', async () => {
      // A misdeployed overlay is a real error the deployer wants to see, and it is now
      // distinguishable from the ordinary "no overlay" case — which is the point of the flag.
      const loading = service.loadConfig();
      await flushNext(isBaseConfig, { defaultTenant: TEST_TENANT, brandingOverlayEnabled: true });
      await flushNext(isOverlay, null, NOT_FOUND);
      await loading;

      expect(service.config().defaultTenant).toBe(TEST_TENANT);
    });
  });

  it('should not raise a toast or a progress bar while bootstrapping', async () => {
    const loading = service.loadConfig();

    const [base] = httpMock.match(isBaseConfig);
    // There is no route to show a toast on and no progress bar to drive yet.
    expect(base.request.context.get(SKIP_LOADING)).toBe(true);
    expect(base.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    base.flush(mockConfig);

    await loading;
  });

  it('should set and persist a same-origin API URL', () => {
    const newUrl = '/some-other-fineract/api/v1';
    expect(service.setApiUrl(newUrl)).toBe(true);

    expect(service.apiUrl).toBe(newUrl);
    expect(JSON.parse(storedRaw()!).fineractApiUrl).toBe(newUrl);
  });

  /**
   * The endpoint override exists so an operator can point the app at their own Fineract. It is
   * not a general redirect: whatever it names receives the user's credentials on the next
   * request, so an origin the deployment did not sanction must be refused outright.
   */
  it('refuses an endpoint the deployment did not allow-list', () => {
    const before = service.apiUrl;

    expect(service.setApiUrl('https://attacker.example/api/v1')).toBe(false);

    expect(service.apiUrl).toBe(before);
    expect(storedRaw()).toBeNull();
  });

  it('accepts an absolute endpoint the deployment allow-listed', async () => {
    create();
    await load({ ...mockConfig, allowedApiOrigins: ['https://fineract.example'] });

    expect(service.setApiUrl('https://fineract.example/fineract-provider/api/v1')).toBe(true);
    expect(service.apiUrl).toBe('https://fineract.example/fineract-provider/api/v1');
  });

  it("should apply the user's stored endpoint on top of the loaded config", async () => {
    service.setApiUrl('/my-server/api/v1');
    create();

    await load(mockConfig);

    // The user's choice wins for the endpoint...
    expect(service.apiUrl).toBe('/my-server/api/v1');
    // ...and for nothing else. An endpoint override that froze the whole object would mean a
    // deployment turning RBAC off never reached anyone who had ever changed their endpoint.
    expect(service.config().defaultTenant).toBe(TEST_TENANT);
  });

  it('should ignore stale deployment settings left in local storage by earlier versions', async () => {
    // Older builds wrote the entire config object under this key.
    storeRaw({ fineractApiUrl: '/old/api/v1', rbacEnabled: false });
    create();

    await load({ rbacEnabled: true });

    expect(service.apiUrl).toBe('/old/api/v1');
    expect(service.rbacEnabled()).toBe(true);
  });

  /**
   * Local storage is writable by anything running as the page, so a stored override is not more
   * trusted than a fresh one — otherwise the allow-list could be bypassed by writing the key
   * directly and reloading.
   */
  it('ignores a stored endpoint that is not allow-listed', async () => {
    storeRaw({ fineractApiUrl: 'https://attacker.example' });
    create();

    await load(mockConfig);

    expect(service.apiUrl).toBe(mockConfig.fineractApiUrl);
  });

  it('should expose the navigation entries a deployment hides', async () => {
    await load({ nav: { hidden: ['nav.groups'] } });

    expect(service.hiddenNavKeys().has('nav.groups')).toBe(true);
    expect(service.hiddenNavKeys().has('nav.clients')).toBe(false);
  });
});
