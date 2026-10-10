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

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { expectLookedUp } from '../../../testing/translated-text';
import { AssetOwnerViewComponent } from './asset-owner-view.component';
import { AuthService } from '../../../core/services/auth.service';
import { provideTestConfig } from '../../../testing/config';
import { createSpyObj, SpyObj } from '../../../testing/mocks';

describe('AssetOwnerViewComponent', () => {
  let fixture: ComponentFixture<AssetOwnerViewComponent>;
  let http: HttpTestingController;
  let authServiceSpy: SpyObj<AuthService>;

  /** Answers every outstanding request whose URL ends with `suffix`, however many views asked. */
  function flushAll(suffix: string, body: object): void {
    for (const request of http.match((r) => r.url.endsWith(suffix))) {
      request.flush(body);
    }
  }

  /** Renders the screen for a user who does, or does not, hold READ_LOAN. */
  async function render(canReadLoan: boolean): Promise<void> {
    authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: canReadLoan ? ['READ_LOAN'] : [] }),
    });
    authServiceSpy.hasPermission.mockReturnValue(canReadLoan);

    await TestBed.configureTestingModule({
      imports: [AssetOwnerViewComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        provideTestConfig({ rbacEnabled: true }),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssetOwnerViewComponent);
    fixture.detectChanges();

    // The screen renders nothing until the transfer arrives, and asks for its journal entries
    // only once it has.
    flushAll('/external-asset-owners/transfers', {
      content: [{ transferId: 7, status: 'ACTIVE', owner: { externalId: 'OWNER-1' } }],
    });
    fixture.detectChanges();
    flushAll('/transfers/7/journal-entries', { journalEntryData: { content: [] } });
    fixture.detectChanges();
  }

  it('renders the loan link and the journal entries tab through the translation adapter', async () => {
    await render(true);

    expectLookedUp(fixture.nativeElement, ['ASSET_OWNERS.VIEW_LOAN_ACCOUNT', 'nav.journalEntries']);
    expect(
      fixture.nativeElement.querySelector('[data-testid="asset-owner-view-loan"]'),
    ).not.toBeNull();
  });

  it('withholds the loan link from a user without READ_LOAN', async () => {
    await render(false);

    // The loan screen is gated on READ_LOAN and this one is not, so the button could only have
    // led to Access Denied. The rest of the screen is unaffected.
    expect(fixture.nativeElement.querySelector('[data-testid="asset-owner-view-loan"]')).toBeNull();
    expectLookedUp(fixture.nativeElement, ['nav.journalEntries']);
  });
});
