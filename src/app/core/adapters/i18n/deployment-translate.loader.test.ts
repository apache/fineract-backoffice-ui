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
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslationObject } from '@ngx-translate/core';
import { DeploymentTranslateLoader } from './deployment-translate.loader';
import { ConfigService } from '../../services/config.service';

const SHIPPED = 'assets/i18n/en.json';
const OVERLAY = 'branding/i18n/en.json';

describe('DeploymentTranslateLoader', () => {
  let http: HttpTestingController;

  /** Builds the loader with the overlay flag the deployment's `config.json` would have set. */
  function create(brandingOverlayEnabled: boolean): DeploymentTranslateLoader {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DeploymentTranslateLoader,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ConfigService,
          useValue: { brandingOverlayEnabled: () => brandingOverlayEnabled },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(DeploymentTranslateLoader);
  }

  afterEach(() => http.verify());

  it('serves the shipped catalogue untouched when no overlay is declared', async () => {
    const loader = create(false);
    const catalogue = new Promise<TranslationObject>((resolve) =>
      loader.getTranslation('en').subscribe(resolve),
    );

    http.expectOne(SHIPPED).flush({ COMMON: { CLIENTS: 'Clients' } });
    expect(await catalogue).toEqual({ COMMON: { CLIENTS: 'Clients' } });
  });

  /**
   * The reason the flag exists. `branding/i18n/` is absent on every default install, so asking
   * for it put a 404 in the console on every load — one the application can decline to report
   * but cannot stop the browser writing. See #487.
   */
  it('does not ask for an overlay the deployment has not declared', async () => {
    const loader = create(false);
    const catalogue = new Promise<TranslationObject>((resolve) =>
      loader.getTranslation('en').subscribe(resolve),
    );

    // Checked before the shipped catalogue is flushed: if the request were going to be made at
    // all, it would already be queued alongside it.
    expect(http.match(OVERLAY).length).toBe(0);

    http.expectOne(SHIPPED).flush({});
    await catalogue;
  });

  it('layers the deployment strings over the shipped ones once declared', async () => {
    const loader = create(true);
    const catalogue = new Promise<TranslationObject>((resolve) =>
      loader.getTranslation('en').subscribe(resolve),
    );

    http.expectOne(SHIPPED).flush({ COMMON: { CLIENTS: 'Clients', SAVE: 'Save' } });
    http.expectOne(OVERLAY).flush({ COMMON: { CLIENTS: 'Members' } });

    // Deep-merged: restating one key must not discard its siblings.
    expect(await catalogue).toEqual({ COMMON: { CLIENTS: 'Members', SAVE: 'Save' } });
  });

  it('falls back to the shipped catalogue when a declared overlay lacks that language', async () => {
    const loader = create(true);
    const catalogue = new Promise<TranslationObject>((resolve) =>
      loader.getTranslation('en').subscribe(resolve),
    );

    http.expectOne(SHIPPED).flush({ COMMON: { CLIENTS: 'Clients' } });
    http.expectOne(OVERLAY).flush(null, { status: 404, statusText: 'Not Found' });

    expect(await catalogue).toEqual({ COMMON: { CLIENTS: 'Clients' } });
  });
});
