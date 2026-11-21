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
import { NgForm, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, type ParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { ClientSearchComponent } from '../../shared/components/client-search/client-search.component';
import { LoanFormComponent } from './loan-form.component';

describe('LoanFormComponent optional repayment date', () => {
  let fixture: ComponentFixture<LoanFormComponent>;
  let component: LoanFormComponent;
  let http: HttpTestingController;
  let routeParams: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [LoanFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}), paramMap: routeParams },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoanFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/loanproducts')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  async function chooseDate() {
    const control = fixture.debugElement
      .query(By.css('ion-datetime[name="repaymentsStartingFromDate"]'))
      .injector.get(NgModel);
    control.control.setValue('2026-11-05');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.repaymentsStartingFromDate).toBe('2026-11-05');
  }
  async function clearDate() {
    const clear = fixture.nativeElement.querySelector('[data-testid="clear-repayment-start-date"]');
    expect(clear).not.toBeNull();
    clear.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const takeCreate = () =>
    http.expectOne((request) => request.method === 'POST' && request.url.endsWith('/loans'));

  it('shows an unset placeholder instead of a fabricated date', () => {
    expect(component.repaymentsStartingFromDate).toBeNull();
    const button = fixture.nativeElement.querySelector(
      'ion-datetime-button[datetime="repaymentsStartingFromDate-picker"]',
    );
    expect(button.querySelector('[slot="date-target"]')?.textContent ?? '').toContain(
      'LOANS.REPAYMENT_START_DATE_NOT_SET',
    );
  });
  it('clears without submitting and omits the optional field', async () => {
    await chooseDate();
    await clearDate();
    expect(component.repaymentsStartingFromDate).toBeNull();
    http.expectNone((request) => request.method === 'POST');
    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).not.toHaveProperty('repaymentsStartingFromDate');
    request.flush({ loanId: 7 });
  });
  it('preserves a chosen calendar day in the existing payload format', async () => {
    await chooseDate();
    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toHaveProperty('repaymentsStartingFromDate', '05 November 2026');
    request.flush({ loanId: 7 });
  });
  it('omits stale date data when cleared after a rejected create', async () => {
    await chooseDate();
    component.onSubmit();
    const rejected = takeCreate();
    expect(rejected.request.body).toHaveProperty('repaymentsStartingFromDate', '05 November 2026');
    rejected.flush(
      { defaultUserMessage: 'Synthetic failure' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.isSaving()).toBe(false);
    await clearDate();
    component.onSubmit();
    const retry = takeCreate();
    expect(retry.request.body).not.toHaveProperty('repaymentsStartingFromDate');
    retry.flush({ loanId: 7 });
  });
  async function loadEditLoan(date: string | number[] | null | undefined) {
    routeParams.next(convertToParamMap({ id: '7' }));
    http
      .expectOne((request) => request.url.endsWith('/loans/7'))
      .flush({
        id: 7,
        clientId: 7,
        principal: 1000,
        timeline: { submittedOnDate: [2026, 4, 1], expectedDisbursementDate: [2026, 4, 2] },
        ...(date === undefined ? {} : { expectedFirstRepaymentOnDate: date }),
      });
    await fixture.whenStable();
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith('/clients/7'))
      .flush({
        id: 7,
        displayName: 'Synthetic Client',
      });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  for (const { name, date } of [
    { name: 'absent', date: undefined },
    { name: 'null', date: null },
  ]) {
    it(`shows the unset placeholder for an ${name} saved repayment date`, async () => {
      await loadEditLoan(date);
      const button = fixture.nativeElement.querySelector(
        'ion-datetime-button[datetime="repaymentsStartingFromDate-picker"]',
      );
      expect(button.querySelector('[slot="date-target"]')?.textContent ?? '').toContain(
        'LOANS.REPAYMENT_START_DATE_NOT_SET',
      );
      expect(component.repaymentsStartingFromDate).toBeNull();
    });
  }

  for (const { name, date } of [
    { name: 'array', date: [2026, 4, 30] },
    { name: 'string', date: '2026-04-30' },
  ]) {
    it(`displays a saved ${name} date without submitting a replacement on unchanged save`, async () => {
      await loadEditLoan(date);
      const control = fixture.debugElement
        .query(By.css('ion-datetime[name="repaymentsStartingFromDate"]'))
        .injector.get(NgModel);
      expect(control.control.value).toBe('2026-04-30');
      expect(component.repaymentsStartingFromDate).toBeNull();
      const button = fixture.nativeElement.querySelector(
        'ion-datetime-button[datetime="repaymentsStartingFromDate-picker"]',
      );
      expect(button.querySelector('[slot="date-target"]')).toBeNull();
      component.onSubmit();
      const update = http.expectOne(
        (request) => request.method === 'PUT' && request.url.endsWith('/loans/7'),
      );
      expect(update.request.body).not.toHaveProperty('repaymentsStartingFromDate');
      update.flush({ loanId: 7 });
    });
  }

  it('submits an officer-selected replacement through the existing date conversion', async () => {
    await loadEditLoan([2026, 4, 30]);
    await chooseDate();
    component.onSubmit();
    const update = http.expectOne(
      (request) => request.method === 'PUT' && request.url.endsWith('/loans/7'),
    );
    expect(update.request.body).toHaveProperty('repaymentsStartingFromDate', '05 November 2026');
    update.flush({ loanId: 7 });
  });

  it('does not introduce a clearing operation for an existing loan', async () => {
    component.isEditMode.set(true);
    await chooseDate();
    expect(
      fixture.nativeElement.querySelector('[data-testid="clear-repayment-start-date"]'),
    ).toBeNull();
  });
});

/**
 * The form's own account of what it needs: #793.
 *
 * Twelve controls carried `required` and not one of them said so, and Save disabled itself
 * without naming the field that had done it.
 */
describe('LoanFormComponent required-field guidance', () => {
  let fixture: ComponentFixture<LoanFormComponent>;
  let component: LoanFormComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}), paramMap: new BehaviorSubject(convertToParamMap({})) },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoanFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/loanproducts')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => {
    // Choosing a product and a client makes the form look both up. These cases are about what
    // the form says about itself, so those lookups are drained rather than asserted on.
    for (const request of http.match(() => true)) request.flush({});
    http.verify();
  });

  const form = (): NgForm =>
    fixture.debugElement.query(By.css('form')).injector.get<NgForm>(NgForm);

  /**
   * The controls the template declares required, read from the rendered form.
   *
   * Scoped to the Ionic host elements: `ion-input` renders a native `input` carrying the same
   * `required` and a generated name, so a bare `[required]` selector returns each control twice
   * and names the inner one `ion-input-153`.
   */
  const requiredControls = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '.loan-form ion-input[required], .loan-form ion-select[required], .loan-form ion-datetime[required]',
      ),
    );

  const requiredNames = (): string[] =>
    requiredControls()
      .map((control) => control.getAttribute('name'))
      .filter((name): name is string => name !== null);

  /** Every required control given a value the platform would accept, and a client chosen. */
  function makeValid(): void {
    component.loan().clientId = 7;
    for (const name of requiredNames()) {
      form().controls[name]?.setValue(name.toLowerCase().includes('date') ? '2026-10-01' : 1);
    }
  }

  it('marks every control it requires', () => {
    const controls = requiredControls();
    // Guards the test itself: a selector that matched nothing would pass the loop silently.
    expect(controls.length).toBeGreaterThanOrEqual(13);

    for (const control of controls) {
      const marker = control.closest('ion-item')?.querySelector('.required-marker');
      expect(marker, `${control.getAttribute('name')} has no required marker`).not.toBeNull();
    }
  });

  it('marks the client field through the shared search component', () => {
    const search = fixture.nativeElement.querySelector('app-client-search');
    expect(search.querySelector('.required-marker')).not.toBeNull();
  });

  it('names the fields holding Save, and says nothing once they are filled', async () => {
    // Nothing chosen yet: the client and every empty required control are named.
    const missing = component.missingRequiredFields(form());
    expect(missing).toContain('COMMON.CLIENT_ID');
    expect(missing).toContain('LOANS.PRINCIPAL');
    expect(fixture.nativeElement.querySelector('[data-testid="loan-submit-hint"]')).not.toBeNull();

    makeValid();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.missingRequiredFields(form())).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="loan-submit-hint"]')).toBeNull();
  });

  it('names whichever single control is missing, for every one it requires', () => {
    makeValid();

    // The map behind the summary has to cover each required control by name. Clearing one at a
    // time is what proves it: a control with no entry leaves the summary empty and fails here
    // naming itself, so a field renamed without touching the map cannot go unnoticed.
    for (const name of requiredNames()) {
      const control = form().controls[name];
      expect(
        control,
        `${name} is declared required but is not a control of the form`,
      ).toBeDefined();
      const original = control.value;
      control.setValue(null);

      const missing = component.missingRequiredFields(form());
      expect(missing, `${name} is required but unnamed`).not.toBe('');
      expect(missing.split(', '), `${name} named something other than itself`).toHaveLength(1);

      control.setValue(original);
    }
  });

  it('keeps Save out of reach until a client is chosen', async () => {
    makeValid();
    component.loan().clientId = undefined;
    await fixture.whenStable();
    fixture.detectChanges();

    // `app-client-search` holds its own reactive control and never joins this NgForm, so the
    // form reads as valid with no client and the button used to enable on it.
    expect(form().invalid).toBe(false);
    expect(component.missingRequiredFields(form())).toContain('COMMON.CLIENT_ID');
    const save = fixture.nativeElement.querySelector('#loan-submit-btn');
    expect(save).not.toBeNull();
    expect(save.disabled).toBe(true);

    // Read off the shadow-root button, not the host: `ion-button` hoists `aria-*` from the host
    // onto its inner native button and removes it from the host, so `save.getAttribute` reads
    // null on a binding that is working. Same family as #514.
    expect(save.shadowRoot?.querySelector('button')?.getAttribute('aria-describedby')).toBe(
      'loan-submit-hint',
    );
  });
});

/**
 * The application fields the form never carried: #792.
 *
 * A loan could be booked but not attributed. There was nowhere to name the officer who owned
 * it, why the client was borrowing, which fund it was drawn against, or which savings account
 * repayments would come from, and the product's own charges were applied unseen. The platform
 * accepts all of them on create and on update; only the form was silent.
 *
 * Each case drives the rendered controls rather than the component fields, because the payload
 * is the product of the template bindings and the submit mapping together, and asserts on the
 * request body: what reaches the platform is the whole point of the issue.
 */
describe('LoanFormComponent optional application fields', () => {
  let fixture: ComponentFixture<LoanFormComponent>;
  let component: LoanFormComponent;
  let http: HttpTestingController;
  let routeParams: BehaviorSubject<ParamMap>;

  /**
   * The option lists as a running platform answers them, field for field.
   *
   * Measured against Fineract rather than read off the generated model, which declares none of
   * these lists. The labels the template reads differ per list -- `displayName` for an officer,
   * `name` for a purpose or a fund, `accountNo` with `productName` for an account -- so a
   * fixture that gave them all the same shape would pass while the screen showed blanks.
   */
  const TEMPLATE = {
    loanOfficerOptions: [
      { id: 3, displayName: 'Mittal, Synthetic', firstname: 'Synthetic', lastname: 'Mittal' },
      { id: 4, displayName: 'Flores, Synthetic' },
    ],
    loanPurposeOptions: [{ id: 24, name: 'Working capital' }],
    fundOptions: [{ id: 5, name: 'Rural credit line' }],
    accountLinkingOptions: [
      { id: 11, accountNo: '000000011', clientId: 7, productName: 'Passbook Savings' },
    ],
    chargeOptions: [
      {
        id: 1,
        name: 'Processing fee',
        amount: 100,
        penalty: false,
        chargeTimeType: { id: 1, code: 'chargeTimeType.disbursement', value: 'Disbursement' },
      },
      {
        id: 2,
        name: 'Late repayment penalty',
        amount: 50,
        penalty: true,
        chargeTimeType: { id: 9, code: 'chargeTimeType.overdueInstallment', value: 'Overdue Fees' },
      },
      {
        id: 3,
        name: 'Annual service fee',
        amount: 75,
        penalty: false,
        chargeTimeType: {
          id: 2,
          code: 'chargeTimeType.specifiedDueDate',
          value: 'Specified due date',
        },
      },
    ],
  };

  /**
   * The product names only the charge ids; the names and amounts come from the template.
   *
   * Carries its term defaults as well, because the form fills the loan's required fields from
   * them. Without that the form is invalid for reasons unrelated to this issue, and Save being
   * out of reach would say nothing about the charge that put it there.
   */
  const PRODUCT = {
    id: 1,
    name: 'Synthetic product',
    principal: 1000,
    numberOfRepayments: 12,
    repaymentEvery: 1,
    repaymentFrequencyType: { id: 2 },
    interestRatePerPeriod: 10,
    interestType: { id: 0 },
    amortizationType: { id: 1 },
    interestCalculationPeriodType: { id: 1 },
    transactionProcessingStrategyCode: 'mifos-standard-strategy',
    charges: [{ id: 1, amount: 100 }],
  };

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [LoanFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}), paramMap: routeParams },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoanFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/loanproducts')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  /**
   * The `NgModel` behind a rendered control.
   *
   * Addressed by `name` where the template writes one statically. A charge row's amount carries
   * `[name]` instead, one per charge, and a property binding does not reflect as a DOM
   * attribute, so those rows are addressed by their `data-testid`.
   */
  const model = (selector: string): NgModel =>
    fixture.debugElement.query(By.css(selector)).injector.get(NgModel);
  const el = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const takeCreate = () =>
    http.expectOne((request) => request.method === 'POST' && request.url.endsWith('/loans'));
  const takeTemplate = () => http.expectOne((request) => request.url.includes('/loans/template'));

  /** Choose a client through the shared search component's own output. */
  async function chooseClient(clientId = 7) {
    fixture.debugElement
      .query(By.directive(ClientSearchComponent))
      .componentInstance.clientSelected.emit(clientId);
    await settle();
    // The form hands the chosen id straight back to `app-client-search` as `initialClientId`,
    // and the search resolves the display name itself. That lookup is not this issue's, but it
    // lands in the same queue and has to be answered for `http.verify()` to mean anything.
    http
      .expectOne((request) => request.url.endsWith(`/clients/${clientId}`))
      .flush({ id: clientId, displayName: 'Synthetic Client' });
    await settle();
  }

  /** Choose a product through the rendered select, then answer both lookups it starts. */
  async function chooseProduct(template: object = TEMPLATE) {
    model('ion-select[name="productId"]').control.setValue(1);
    await settle();
    http.expectOne((request) => request.url.endsWith('/loanproducts/1')).flush(PRODUCT);
    await settle();
    takeTemplate().flush(template);
    await settle();
  }

  it('asks for the option lists only once a client and a product are both chosen', async () => {
    // A client alone is not enough: asked without a product, the template answers none of
    // these lists, so the form would populate empty selects from a successful response.
    await chooseClient();
    http.expectNone((request) => request.url.includes('/loans/template'));
    expect(el('loan-options-hint')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ion-select[name="loanOfficerId"]')).toBeNull();

    model('ion-select[name="productId"]').control.setValue(1);
    await settle();
    http.expectOne((request) => request.url.endsWith('/loanproducts/1')).flush(PRODUCT);
    await settle();

    const template = takeTemplate();
    expect(template.request.params.get('clientId')).toBe('7');
    expect(template.request.params.get('productId')).toBe('1');
    expect(template.request.params.get('templateType')).toBe('individual');
    template.flush(TEMPLATE);
    await settle();

    expect(el('loan-options-hint')).toBeNull();
    expect(fixture.nativeElement.querySelector('ion-select[name="loanOfficerId"]')).not.toBeNull();
  });

  it('labels each option list by the field that list actually carries', async () => {
    await chooseClient();
    await chooseProduct();

    const labels = (name: string) =>
      Array.from(
        fixture.nativeElement.querySelectorAll(`ion-select[name="${name}"] ion-select-option`),
      ).map((option) => (option as HTMLElement).textContent?.trim());

    expect(labels('loanOfficerId')).toEqual(['Mittal, Synthetic', 'Flores, Synthetic']);
    expect(labels('loanPurposeId')).toEqual(['Working capital']);
    expect(labels('fundId')).toEqual(['Rural credit line']);
    // Account number alone does not tell the operator which savings product it is.
    expect(labels('linkAccountId')).toEqual(['LOANS.ACCOUNT_OPTION']);
  });

  it('carries the chosen officer, purpose and fund', async () => {
    await chooseClient();
    await chooseProduct();

    model('ion-select[name="loanOfficerId"]').control.setValue(3);
    model('ion-select[name="loanPurposeId"]').control.setValue(24);
    model('ion-select[name="fundId"]').control.setValue(5);
    await settle();

    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toMatchObject({
      clientId: 7,
      productId: 1,
      loanOfficerId: 3,
      loanPurposeId: 24,
      fundId: 5,
    });
    request.flush({ loanId: 7 });
  });

  it('omits every optional field left untouched rather than sending it null', async () => {
    await chooseClient();
    await chooseProduct();

    component.onSubmit();
    const request = takeCreate();
    for (const field of [
      'loanOfficerId',
      'loanPurposeId',
      'fundId',
      'linkAccountId',
      'createStandingInstructionAtDisbursement',
    ]) {
      expect(request.request.body, field).not.toHaveProperty(field);
    }
    request.flush({ loanId: 7 });
  });

  it('offers the standing instruction only alongside an account, and never without one', async () => {
    await chooseClient();
    await chooseProduct();

    // The flag means nothing on its own, so it is not even on screen until an account is chosen.
    expect(el('loan-standing-instruction-checkbox')).toBeNull();

    model('ion-select[name="linkAccountId"]').control.setValue(11);
    await settle();
    expect(el('loan-standing-instruction-checkbox')).not.toBeNull();
    model('ion-checkbox[name="createStandingInstructionAtDisbursement"]').control.setValue(true);
    await settle();

    component.onSubmit();
    const withAccount = takeCreate();
    expect(withAccount.request.body).toMatchObject({
      linkAccountId: 11,
      createStandingInstructionAtDisbursement: true,
    });
    withAccount.flush(
      { defaultUserMessage: 'Synthetic failure' },
      { status: 400, statusText: 'Bad Request' },
    );

    // Dropping the account has to drop the flag with it: the platform refuses the pair, and the
    // checkbox leaves the screen before the operator can untick it.
    model('ion-select[name="linkAccountId"]').control.setValue(null);
    await settle();
    component.onSubmit();
    const retry = takeCreate();
    expect(retry.request.body).not.toHaveProperty('linkAccountId');
    expect(retry.request.body).not.toHaveProperty('createStandingInstructionAtDisbursement');
    retry.flush({ loanId: 7 });
  });

  it('tells the operator when the client has no account to link', async () => {
    await chooseClient();
    await chooseProduct({ ...TEMPLATE, accountLinkingOptions: [] });

    expect(fixture.nativeElement.querySelector('ion-select[name="linkAccountId"]')).toBeNull();
    expect(el('loan-no-linkable-accounts')).not.toBeNull();
  });

  it("shows the product's own charges, named and priced, before anything is submitted", async () => {
    await chooseClient();
    await chooseProduct();

    const row = el('loan-charge-1');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('Processing fee');
    expect(row?.textContent).toContain('Disbursement');
    expect(model('[data-testid="loan-charge-amount-1"]').control.value).toBe(100);
    // Only the charges the product actually names.
    expect(el('loan-charge-2')).toBeNull();
    expect(el('loan-no-charges')).toBeNull();

    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toHaveProperty('charges', [{ chargeId: 1, amount: 100 }]);
    request.flush({ loanId: 7 });
  });

  it('submits an amount the operator overrode', async () => {
    await chooseClient();
    await chooseProduct();

    model('[data-testid="loan-charge-amount-1"]').control.setValue(250);
    await settle();

    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toHaveProperty('charges', [{ chargeId: 1, amount: 250 }]);
    request.flush({ loanId: 7 });
  });

  it('adds a charge the product did not name, keeping the flag it came with', async () => {
    await chooseClient();
    await chooseProduct();

    model('ion-select[name="chargeToAdd"]').control.setValue(2);
    await settle();
    el('loan-charge-add-btn')?.click();
    await settle();

    const added = el('loan-charge-2');
    expect(added?.textContent).toContain('Late repayment penalty');
    expect(added?.textContent).toContain('LOANS.PENALTY');
    // A charge already on the application is no longer offered, so it cannot be added twice.
    const offered = Array.from(
      fixture.nativeElement.querySelectorAll('ion-select[name="chargeToAdd"] ion-select-option'),
    ).map((option) => (option as HTMLElement).textContent?.trim());
    expect(offered).toEqual(['Annual service fee']);

    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toHaveProperty('charges', [
      { chargeId: 1, amount: 100 },
      { chargeId: 2, amount: 50 },
    ]);
    request.flush({ loanId: 7 });
  });

  it('omits charges entirely once the last one is removed', async () => {
    await chooseClient();
    await chooseProduct();

    el('loan-charge-remove-1')?.click();
    await settle();
    expect(el('loan-charge-1')).toBeNull();
    expect(el('loan-no-charges')).not.toBeNull();

    component.onSubmit();
    const request = takeCreate();
    // Not `charges: []`, which the platform reads as a list it should apply.
    expect(request.request.body).not.toHaveProperty('charges');
    request.flush({ loanId: 7 });
  });

  it('leaves an edited list alone when the product answers again', async () => {
    await chooseClient();
    await chooseProduct();
    model('[data-testid="loan-charge-amount-1"]').control.setValue(250);
    await settle();

    // Picking the product a second time re-seeds, and must not undo an override.
    model('ion-select[name="productId"]').control.setValue(1);
    await settle();
    http.expectOne((request) => request.url.endsWith('/loanproducts/1')).flush(PRODUCT);
    await settle();
    takeTemplate().flush(TEMPLATE);
    await settle();

    expect(model('[data-testid="loan-charge-amount-1"]').control.value).toBe(250);
  });

  /**
   * The charge the platform will not take on trust.
   *
   * A `specifiedDueDate` charge sent as `{chargeId, amount}` is refused outright, 403
   * `error.msg.loanCharge.cannot.be.added.as.specified.due.date.outside.range`, and the date it
   * names is the submission date -- the platform has no usable default of its own. Measured
   * against a running Fineract; the backend spec is the version of this that proves it there.
   */
  async function addDueDateCharge() {
    model('ion-select[name="chargeToAdd"]').control.setValue(3);
    await settle();
    el('loan-charge-add-btn')?.click();
    await settle();
  }

  const submitButton = () => el('loan-submit-btn') as (HTMLElement & { disabled: boolean }) | null;
  const ngForm = () => fixture.debugElement.query(By.css('form')).injector.get<NgForm>(NgForm);

  it('holds Save and names the charge until its due date is given', async () => {
    await chooseClient();
    await chooseProduct();
    await addDueDateCharge();

    // Only the row that needs a date asks for one.
    expect(el('loan-charge-due-date-3')).not.toBeNull();
    expect(el('loan-charge-due-date-1')).toBeNull();

    expect(component.missingRequiredFields(ngForm())).toContain('LOANS.CHARGE_DUE_DATE_FOR');
    expect(el('loan-submit-hint')).not.toBeNull();
    expect(submitButton()?.disabled).toBe(true);

    model('[data-testid="loan-charge-due-date-3"]').control.setValue('2026-12-21');
    await settle();

    expect(component.missingRequiredFields(ngForm())).toBe('');
    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toHaveProperty('charges', [
      { chargeId: 1, amount: 100 },
      { chargeId: 3, amount: 75, dueDate: '21 December 2026' },
    ]);
    request.flush({ loanId: 7 });
  });

  it('stops naming a charge that was removed rather than dated', async () => {
    await chooseClient();
    await chooseProduct();
    await addDueDateCharge();
    el('loan-charge-remove-3')?.click();
    await settle();

    expect(component.missingRequiredFields(ngForm())).toBe('');
    expect(submitButton()?.disabled).toBe(false);

    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body).toHaveProperty('charges', [{ chargeId: 1, amount: 100 }]);
    request.flush({ loanId: 7 });
  });

  /** An existing application, with every field this issue adds already set on the platform. */
  async function loadEditLoan() {
    routeParams.next(convertToParamMap({ id: '7' }));
    const load = http.expectOne((request) => request.url.endsWith('/loans/7'));
    // `charges` and `linkedAccount` are associations. Asked for without them the response
    // carries neither key, so the form showed no charges and no linked account however many the
    // loan had. Only a real platform could say so: a mock answers whatever it is asked to.
    // Read back decoded: the generated client percent-encodes the separator, which the platform
    // decodes again -- the backend spec is what proves it accepts the pair.
    expect(decodeURIComponent(load.request.params.get('associations') ?? '')).toBe(
      'charges,linkedAccount',
    );
    load.flush({
      id: 7,
      clientId: 7,
      loanProductId: 1,
      // Stated as an enum, as the platform states it; the request wants the bare word.
      loanType: { id: 1, code: 'accountType.individual', value: 'Individual' },
      principal: 1000,
      // Both come back from the platform; only one of them may be sent to it again.
      interestRecognitionOnDisbursementDate: false,
      allowFullTermForTranche: false,
      loanOfficerId: 3,
      loanPurposeId: 24,
      fundId: 5,
      linkedAccount: { id: 11 },
      charges: [
        {
          chargeId: 1,
          name: 'Processing fee',
          amount: 180,
          chargeTimeType: { code: 'chargeTimeType.disbursement', value: 'Disbursement' },
        },
        {
          chargeId: 3,
          name: 'Annual service fee',
          amount: 75,
          // A stored date, in the array form the platform returns it in.
          dueDate: [2026, 12, 21],
          chargeTimeType: {
            code: 'chargeTimeType.specifiedDueDate',
            value: 'Specified due date',
          },
        },
      ],
      timeline: { submittedOnDate: [2026, 4, 1], expectedDisbursementDate: [2026, 4, 2] },
    });
    await settle();
    http
      .expectOne((request) => request.url.endsWith('/clients/7'))
      .flush({
        id: 7,
        displayName: 'Synthetic Client',
      });
    await settle();
    http.expectOne((request) => request.url.endsWith('/loanproducts/1')).flush(PRODUCT);
    await settle();
    takeTemplate().flush(TEMPLATE);
    await settle();
  }

  it('preserves the saved values on an unchanged save', async () => {
    await loadEditLoan();

    expect(model('ion-select[name="loanOfficerId"]').control.value).toBe(3);
    expect(model('ion-select[name="loanPurposeId"]').control.value).toBe(24);
    expect(model('ion-select[name="fundId"]').control.value).toBe(5);
    expect(model('ion-select[name="linkAccountId"]').control.value).toBe(11);
    // The loan's own amount, not the product's default.
    expect(model('[data-testid="loan-charge-amount-1"]').control.value).toBe(180);
    // A saved due date comes back as a date, not re-asked for and not dropped on save.
    expect(model('[data-testid="loan-charge-due-date-3"]').control.value).toBe('2026-12-21');

    component.onSubmit();
    const update = http.expectOne(
      (request) => request.method === 'PUT' && request.url.endsWith('/loans/7'),
    );
    expect(update.request.body).toMatchObject({
      // Mandatory on update: without it the platform refuses the whole update, 400
      // `validation.msg.loan.loanType.cannot.be.blank`, whatever else was changed.
      loanType: 'individual',
      // Accepted on update, unlike `interestRecognitionOnDisbursementDate` below.
      allowFullTermForTranche: false,
      loanOfficerId: 3,
      loanPurposeId: 24,
      fundId: 5,
      linkAccountId: 11,
      charges: [
        { chargeId: 1, amount: 180 },
        { chargeId: 3, amount: 75, dueDate: '21 December 2026' },
      ],
    });
    // Read back from the loan and sent straight out again, this one is refused by the update
    // command itself -- 400 `error.msg.parameter.unsupported` -- so every edit failed over it.
    expect(update.request.body).not.toHaveProperty('interestRecognitionOnDisbursementDate');
    update.flush({ loanId: 7 });
  });

  it('submits a reassignment without disturbing the rest', async () => {
    await loadEditLoan();

    model('ion-select[name="loanOfficerId"]').control.setValue(4);
    await settle();

    component.onSubmit();
    const update = http.expectOne(
      (request) => request.method === 'PUT' && request.url.endsWith('/loans/7'),
    );
    expect(update.request.body).toMatchObject({
      loanOfficerId: 4,
      loanPurposeId: 24,
      fundId: 5,
    });
    update.flush({ loanId: 7 });
  });
});
