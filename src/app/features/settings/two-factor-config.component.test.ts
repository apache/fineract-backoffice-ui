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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { TwoFactorConfigComponent } from './two-factor-config.component';

/**
 * What the screen says when the platform does not hand it a configuration (#749).
 *
 * The two answers mean opposite things and used to look identical: an empty editor.
 */
describe('TwoFactorConfigComponent load outcomes', () => {
  let fixture: ComponentFixture<TwoFactorConfigComponent>;
  let component: TwoFactorConfigComponent;
  let http: HttpTestingController;
  let fakes: ReturnType<typeof provideFakeAdapters>;

  beforeEach(async () => {
    fakes = provideFakeAdapters();
    await TestBed.configureTestingModule({
      imports: [TwoFactorConfigComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...fakes.providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TwoFactorConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const takeLoad = () => http.expectOne((request) => request.url.endsWith('/twofactor/configure'));
  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('opens the editor on a 404, because that is how a configuration is created', async () => {
    takeLoad().flush('Not found', { status: 404, statusText: 'Not Found' });
    await settle();

    expect(component.loadFailed()).toBe(false);
    expect(query('[data-testid="two-factor-config-load-error"]')).toBeNull();
    expect(query('ion-textarea')).not.toBeNull();
    // Nothing to report: a tenant without a configuration is not a failure.
    expect(fakes.overlay.toasts).toHaveLength(0);
  });

  it('shows an error state with a retry when the load actually fails', async () => {
    takeLoad().flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(component.loadFailed()).toBe(true);
    expect(query('[data-testid="two-factor-config-load-error"]')).not.toBeNull();
    // The editor is withheld: empty, it reads as "this tenant has no second factor".
    expect(query('ion-textarea')).toBeNull();
    expect(fakes.overlay.lastToast?.message).toContain('LOAD_FAILED');

    component.loadConfig();
    await settle();
    takeLoad().flush(JSON.stringify({ enabled: true }));
    await settle();

    expect(component.loadFailed()).toBe(false);
    expect(query('[data-testid="two-factor-config-load-error"]')).toBeNull();
    expect(component.configJson()).toContain('enabled');
  });

  it('reports invalid JSON as a failure rather than a success', async () => {
    takeLoad().flush(JSON.stringify({ enabled: true }));
    await settle();

    component.configJson.set('{ not json');
    component.onSave();
    await settle();

    // No request leaves the browser, and the toast is not the green one it used to be.
    http.expectNone((request) => request.method === 'PUT');
    expect(fakes.overlay.lastToast?.message).toContain('PARSE_ERROR');
    expect(fakes.overlay.lastToast?.cssClass).toBe('error-toast');
  });
});
