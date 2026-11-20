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
