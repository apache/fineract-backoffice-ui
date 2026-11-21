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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { SavingsAccountFormComponent } from './savings-account-form.component';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { BUSINESS_DATE_API } from '../../core/adapters';
import { AuthService, UserSession } from '../../core/services/auth.service';

/**
 * A tenant without the business-date feature, so `PlatformDateService` resolves today from the
 * platform's clock and makes no request of its own — these cases are about the rate, and an
 * unflushed configuration read would fail them for an unrelated reason.
 */
const NO_BUSINESS_DATE = {
  provide: BUSINESS_DATE_API,
  useValue: { getBusinessDates: () => of([]), isBusinessDateEnabled: () => of(false) },
};

function session(permissions: string[]): UserSession {
  return {
    username: 'tester',
    base64EncodedAuthenticationKey: 'key',
    authenticated: true,
    officeId: 1,
    officeName: 'Head Office',
    userId: 1,
    permissions,
  };
}

/**
 * #761. Every savings account opened through this form earned 0%.
 *
 * The form started its Interest Rate field at `0` and sent it on every submit. Fineract reads a
 * rate in the request as an account-level override, so the product's rate was discarded — a 5%
 * product opened an account paying nothing, and the depositor would only find out at interest
 * posting.
 *
 * These assert the **payload**, through `HttpTestingController`, because that is where the defect
 * was: the rendered form looked the same either way. The fixtures are what
 * `GET /savingsproducts` actually answers — a list row carries the product's own
 * `nominalAnnualInterestRate`, measured as 3.75 for a product configured at 3.75%.
 */
describe('SavingsAccountFormComponent interest rate', () => {
  let fixture: ComponentFixture<SavingsAccountFormComponent>;
  let component: SavingsAccountFormComponent;
  let http: HttpTestingController;

  const PRODUCT = {
    id: 42,
    name: 'Probe Savings 3.75%',
    shortName: 'P375',
    nominalAnnualInterestRate: 3.75,
    currency: { code: 'USD', decimalPlaces: 2 },
  };

  async function setup(): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SavingsAccountFormComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        NO_BUSINESS_DATE,
        { provide: Router, useValue: { navigate: () => undefined, url: '' } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}), paramMap: of({ get: () => null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsAccountFormComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // The product list the form loads on init — and the only source the rate prefill needs.
    http
      .expectOne((request) => request.method === 'GET' && request.url.endsWith('/savingsproducts'))
      .flush([PRODUCT]);
    fixture.detectChanges();
  }

  /** The body of the create request, after a submit. */
  function submitted(): Record<string, unknown> {
    const request = http.expectOne(
      (candidate) => candidate.method === 'POST' && candidate.url.endsWith('/savingsaccounts'),
    );
    const body = request.request.body as Record<string, unknown>;
    request.flush({ resourceId: 1 });
    return body;
  }

  const DEFAULT_PLAIN_PRODUCT = {
    id: 42,
    name: 'Probe Savings 3.75%',
    allowOverdraft: false,
  };

  function selectProduct(
    id = 42,
    productDetail: Record<string, unknown> = DEFAULT_PLAIN_PRODUCT,
  ): void {
    component.onProductChanged(id);
    const detailReqs = http.match(
      (candidate) => candidate.method === 'GET' && candidate.url.endsWith(`/savingsproducts/${id}`),
    );
    for (const req of detailReqs) {
      req.flush(productDetail);
    }
  }

  it('takes the rate from the product the user chose', async () => {
    await setup();

    selectProduct(42);

    expect(component.interestRate()).toBe(3.75);
  });

  it('sends the product rate, so the account is not opened at zero', async () => {
    await setup();
    selectProduct(42);

    component.onSubmit();

    expect(submitted()['nominalAnnualInterestRate']).toBe(3.75);
  });

  it('omits the rate entirely when no product rate is known', async () => {
    // Omission is how the platform is asked to apply the product's own rate. Sending `0` is the
    // bug: it is a valid override, and it overrides with nothing.
    await setup();

    component.onSubmit();

    const body = submitted();
    expect('nominalAnnualInterestRate' in body).toBe(false);
  });

  it('keeps a rate the user typed, including a deliberate zero', async () => {
    // 0% is a rate an institution may mean, so it cannot double as "not filled in" — which is
    // why the field starts empty rather than at zero.
    await setup();
    selectProduct(42);

    component.onInterestRateChanged(0);
    component.onSubmit();

    expect(submitted()['nominalAnnualInterestRate']).toBe(0);
  });

  it('treats a cleared field as not stated, rather than as zero', async () => {
    await setup();
    selectProduct(42);

    component.onInterestRateChanged('');

    expect(component.interestRate()).toBeNull();
    component.onSubmit();
    expect('nominalAnnualInterestRate' in submitted()).toBe(false);
  });

  it('prefills the rate when the product was chosen before the list arrived', async () => {
    // A client-scoped route pre-selects the product id, and the list lands afterwards.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SavingsAccountFormComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        NO_BUSINESS_DATE,
        { provide: Router, useValue: { navigate: () => undefined, url: '' } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({ clientId: '7' }), paramMap: of({ get: () => null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsAccountFormComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    component.account.update((account) => ({ ...account, productId: 42 }));

    http
      .expectOne((request) => request.method === 'GET' && request.url.endsWith('/savingsproducts'))
      .flush([PRODUCT]);

    const productReqs = http.match((c) => c.method === 'GET' && c.url.endsWith('/savingsproducts/42'));
    for (const req of productReqs) {
      req.flush({ id: 42, allowOverdraft: false });
    }

    expect(component.interestRate()).toBe(3.75);

    // The client search reads the pre-selected client; answered so the verify below is clean.
    for (const request of http.match((candidate) => candidate.url.includes('/clients/'))) {
      request.flush({ id: 7, displayName: 'Probe Client' });
    }
  });

  afterEach(() => http.verify());
});

describe('SavingsAccountFormComponent overdraft', () => {
  let fixture: ComponentFixture<SavingsAccountFormComponent>;
  let component: SavingsAccountFormComponent;
  let http: HttpTestingController;

  const PRODUCT_WITH_OVERDRAFT = {
    id: 50,
    name: 'Overdraft Savings',
    shortName: 'ODS',
    nominalAnnualInterestRate: 2.5,
    allowOverdraft: true,
    overdraftLimit: 1000,
    nominalAnnualInterestRateOverdraft: 12,
    minOverdraftForInterestCalculation: 50,
  };

  const PRODUCT_WITHOUT_OVERDRAFT = {
    id: 51,
    name: 'Plain Savings',
    shortName: 'PS',
    nominalAnnualInterestRate: 2.5,
    allowOverdraft: false,
  };

  async function setup(
    routeParams: Record<string, string> = {},
    permissions = ['ALL_FUNCTIONS'],
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SavingsAccountFormComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        NO_BUSINESS_DATE,
        { provide: Router, useValue: { navigate: () => undefined, url: '' } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            paramMap: of({ get: (key: string) => routeParams[key] ?? null }),
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(AuthService).currentUser.set(session(permissions));

    fixture = TestBed.createComponent(SavingsAccountFormComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http
      .expectOne((request) => request.method === 'GET' && request.url.endsWith('/savingsproducts'))
      .flush([PRODUCT_WITH_OVERDRAFT, PRODUCT_WITHOUT_OVERDRAFT]);
    fixture.detectChanges();
  }

  function chooseProduct(product: typeof PRODUCT_WITH_OVERDRAFT | typeof PRODUCT_WITHOUT_OVERDRAFT): void {
    component.onProductChanged(product.id);
    const req = http.expectOne(
      (candidate) => candidate.method === 'GET' && candidate.url.endsWith(`/savingsproducts/${product.id}`),
    );
    req.flush(product);
    fixture.detectChanges();
  }

  function submitCreate(): Record<string, unknown> {
    component.onSubmit();
    const req = http.expectOne(
      (candidate) => candidate.method === 'POST' && candidate.url.endsWith('/savingsaccounts'),
    );
    const body = req.request.body as Record<string, unknown>;
    req.flush({ resourceId: 101 });
    return body;
  }

  function submitEdit(accountId = 77): Record<string, unknown> {
    component.onSubmit();
    const req = http.expectOne(
      (candidate) => candidate.method === 'PUT' && candidate.url.endsWith(`/savingsaccounts/${accountId}`),
    );
    const body = req.request.body as Record<string, unknown>;
    req.flush({ resourceId: accountId });
    return body;
  }

  it('hides the overdraft group when the product disallows overdraft', async () => {
    await setup();
    chooseProduct(PRODUCT_WITHOUT_OVERDRAFT);

    expect(component.productAllowsOverdraft()).toBe(false);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="savings-overdraft-group"]')).toBeNull();

    const body = submitCreate();
    expect('allowOverdraft' in body).toBe(false);
    expect('overdraftLimit' in body).toBe(false);
  });

  it('shows the overdraft group and prefills product defaults on create', async () => {
    await setup();
    chooseProduct(PRODUCT_WITH_OVERDRAFT);

    expect(component.productAllowsOverdraft()).toBe(true);
    expect(component.allowOverdraft()).toBe(true);
    expect(component.overdraftLimit()).toBe(1000);
    expect(component.nominalAnnualInterestRateOverdraft()).toBe(12);
    expect(component.minOverdraftForInterestCalculation()).toBe(50);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="savings-overdraft-group"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="savings-allow-overdraft"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="savings-overdraft-limit"]')).not.toBeNull();
  });

  it('includes overdraft fields in create payload when allowOverdraft is true', async () => {
    await setup();
    chooseProduct(PRODUCT_WITH_OVERDRAFT);

    const body = submitCreate();
    expect(body['allowOverdraft']).toBe(true);
    expect(body['overdraftLimit']).toBe(1000);
    expect(body['nominalAnnualInterestRateOverdraft']).toBe(12);
    expect(body['minOverdraftForInterestCalculation']).toBe(50);
  });

  it('omits overdraft fields from payload when allowOverdraft is unchecked', async () => {
    await setup();
    chooseProduct(PRODUCT_WITH_OVERDRAFT);

    component.onAllowOverdraftChanged(false);
    fixture.detectChanges();

    const body = submitCreate();
    expect('allowOverdraft' in body).toBe(false);
    expect('overdraftLimit' in body).toBe(false);
    expect('nominalAnnualInterestRateOverdraft' in body).toBe(false);
    expect('minOverdraftForInterestCalculation' in body).toBe(false);
  });

  it('validates overdraft limit against product max and requires a limit', async () => {
    await setup();
    chooseProduct(PRODUCT_WITH_OVERDRAFT);

    // Product max is 1000: exceeds max
    component.onOverdraftLimitChanged(1500);
    fixture.detectChanges();

    expect(component.isOverdraftLimitExceeded()).toBe(true);
    expect(component.isOverdraftInvalid()).toBe(true);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="savings-overdraft-limit-error"]')).not.toBeNull();

    // At or below max: valid
    component.onOverdraftLimitChanged(800);
    fixture.detectChanges();

    expect(component.isOverdraftLimitExceeded()).toBe(false);
    expect(component.isOverdraftInvalid()).toBe(false);

    // Cleared limit: invalid because required when allowOverdraft is true
    component.onOverdraftLimitChanged('');
    fixture.detectChanges();

    expect(component.isOverdraftInvalid()).toBe(true);
  });

  describe('edit mode and permission gating', () => {
    const ACCOUNT_DATA = {
      id: 77,
      clientId: 12,
      savingsProductId: 50,
      allowOverdraft: true,
      overdraftLimit: 400,
      nominalAnnualInterestRateOverdraft: 9,
      minOverdraftForInterestCalculation: 20,
    };

    it('prefills existing overdraft fields from SavingsAccountData on edit', async () => {
      await setup({ id: '77' }, ['UPDATE_SAVINGSACCOUNT']);

      const getReq = http.expectOne(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('/savingsaccounts/77'),
      );
      getReq.flush(ACCOUNT_DATA);

      const prodReq = http.expectOne(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('/savingsproducts/50'),
      );
      prodReq.flush(PRODUCT_WITH_OVERDRAFT);
      fixture.detectChanges();

      for (const req of http.match((c) => c.url.includes('/clients/'))) {
        req.flush({ id: 12, displayName: 'Test Client' });
      }

      expect(component.isEditMode()).toBe(true);
      expect(component.allowOverdraft()).toBe(true);
      // Keeps account's own overdraft limit (400) rather than overwriting with product max (1000)
      expect(component.overdraftLimit()).toBe(400);
      expect(component.nominalAnnualInterestRateOverdraft()).toBe(9);
      expect(component.minOverdraftForInterestCalculation()).toBe(20);

      const body = submitEdit(77);
      expect(body['allowOverdraft']).toBe(true);
      expect(body['overdraftLimit']).toBe(400);
      expect(body['nominalAnnualInterestRateOverdraft']).toBe(9);
      expect(body['minOverdraftForInterestCalculation']).toBe(20);
    });

    it('sends allowOverdraft: false and omits limit fields when user unchecks overdraft on edit', async () => {
      await setup({ id: '77' }, ['UPDATE_SAVINGSACCOUNT']);

      const getReq = http.expectOne(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('/savingsaccounts/77'),
      );
      getReq.flush(ACCOUNT_DATA);

      const prodReq = http.expectOne(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('/savingsproducts/50'),
      );
      prodReq.flush(PRODUCT_WITH_OVERDRAFT);
      fixture.detectChanges();

      for (const req of http.match((c) => c.url.includes('/clients/'))) {
        req.flush({ id: 12, displayName: 'Test Client' });
      }

      expect(component.allowOverdraft()).toBe(true);
      component.onAllowOverdraftChanged(false);
      fixture.detectChanges();

      const body = submitEdit(77);
      expect(body['allowOverdraft']).toBe(false);
      expect('overdraftLimit' in body).toBe(false);
      expect('nominalAnnualInterestRateOverdraft' in body).toBe(false);
      expect('minOverdraftForInterestCalculation' in body).toBe(false);
    });

    it('disables overdraft inputs and omits all overdraft keys when user lacks UPDATE_SAVINGSACCOUNT', async () => {
      // User only has READ_SAVINGSACCOUNT
      await setup({ id: '77' }, ['READ_SAVINGSACCOUNT']);

      const getReq = http.expectOne(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('/savingsaccounts/77'),
      );
      getReq.flush(ACCOUNT_DATA);

      const prodReq = http.expectOne(
        (candidate) => candidate.method === 'GET' && candidate.url.endsWith('/savingsproducts/50'),
      );
      prodReq.flush(PRODUCT_WITH_OVERDRAFT);
      fixture.detectChanges();

      for (const req of http.match((c) => c.url.includes('/clients/'))) {
        req.flush({ id: 12, displayName: 'Test Client' });
      }

      expect(component.hasUpdatePermission()).toBe(false);
      expect(component.canEditOverdraft()).toBe(false);

      const host = fixture.nativeElement as HTMLElement;
      const checkbox = host.querySelector('[data-testid="savings-allow-overdraft"]');
      expect(checkbox?.hasAttribute('disabled')).toBe(true);

      const limitInput = host.querySelector('[data-testid="savings-overdraft-limit"]');
      expect(limitInput?.hasAttribute('disabled')).toBe(true);

      // Omits all overdraft fields when user lacks update permission
      const body = submitEdit(77);
      expect('allowOverdraft' in body).toBe(false);
      expect('overdraftLimit' in body).toBe(false);
      expect('nominalAnnualInterestRateOverdraft' in body).toBe(false);
      expect('minOverdraftForInterestCalculation' in body).toBe(false);
    });
  });

  afterEach(() => http.verify());
});
