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
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { PlatformDateService } from '../../../core/services/platform-date.service';
import { ClientFamilyMemberFormComponent } from './client-family-member-form.component';

describe('Family member optional DOB', () => {
  let fixture: ComponentFixture<ClientFamilyMemberFormComponent>;
  let component: ClientFamilyMemberFormComponent;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientFamilyMemberFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'clientId' ? '7' : null) } },
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClientFamilyMemberFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith('/clients/7/familymembers/template'))
      .flush({});
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  async function chooseDate() {
    fixture.nativeElement
      .querySelector('#family-dob-picker')
      .dispatchEvent(new CustomEvent('ionChange', { detail: { value: '1990-01-05T00:00:00' } }));
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function clearDate() {
    const clear = fixture.nativeElement.querySelector('[data-testid="clear-family-date-of-birth"]');
    expect(clear).not.toBeNull();
    clear.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const takeCreate = () =>
    http.expectOne(
      (request) => request.method === 'POST' && request.url.endsWith('/clients/7/familymembers'),
    );
  it('shows Not set for an absent DOB and sends no fabricated date', () => {
    const button = fixture.nativeElement.querySelector(
      'ion-datetime-button[datetime="family-dob-picker"]',
    );
    expect(button.querySelector('[slot="date-target"]')?.textContent ?? '').toContain(
      'CLIENTS.DATE_OF_BIRTH_NOT_SET',
    );
    component.onSubmit();
    const request = takeCreate();
    expect(JSON.parse(request.request.serializeBody() as string)).not.toHaveProperty('dateOfBirth');
    request.flush({ resourceId: 8 });
  });
  it('preserves the explicitly chosen calendar day', async () => {
    await chooseDate();
    component.onSubmit();
    const request = takeCreate();
    expect(request.request.body.dateOfBirth).toBe('05 January 1990');
    request.flush({ resourceId: 8 });
  });
  it('clears without submitting and resets the linked picker', async () => {
    await chooseDate();
    await clearDate();
    expect(component.dateOfBirth).toBeUndefined();
    expect(fixture.nativeElement.querySelector('#family-dob-picker').value).toBeNull();
    http.expectNone((request) => request.method === 'POST');
    component.onSubmit();
    const request = takeCreate();
    expect(JSON.parse(request.request.serializeBody() as string)).not.toHaveProperty('dateOfBirth');
    request.flush({ resourceId: 8 });
  });
  it('omits the prior date after a rejected create is cleared and retried', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await chooseDate();
      component.onSubmit();
      const first = takeCreate();
      expect(first.request.body.dateOfBirth).toBe('05 January 1990');
      first.flush({}, { status: 400, statusText: 'Synthetic failure' });
      await clearDate();
      component.onSubmit();
      const retry = takeCreate();
      expect(JSON.parse(retry.request.serializeBody() as string)).not.toHaveProperty('dateOfBirth');
      retry.flush({ resourceId: 8 });
    } finally {
      log.mockRestore();
    }
  });
  it('preserves existing edit serialization without offering create-only clearing', async () => {
    component.isEditMode = true;
    component.memberId = 8;
    await chooseDate();
    expect(
      fixture.nativeElement.querySelector('[data-testid="clear-family-date-of-birth"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('[slot="date-target"]')).toBeNull();
    component.onSubmit();
    const request = http.expectOne(
      (request) => request.method === 'PUT' && request.url.endsWith('/clients/7/familymembers/8'),
    );
    expect(request.request.body.dateOfBirth).toBe('05 January 1990');
    request.flush({ resourceId: 8 });
  });
  async function loadEditMember(dateOfBirth?: number[] | string | null) {
    component.isEditMode = true;
    component.memberId = 8;
    component.loadMemberData();
    http
      .expectOne(
        (request) => request.method === 'GET' && request.url.endsWith('/clients/7/familymembers/8'),
      )
      .flush({
        firstName: 'Synthetic',
        lastName: 'Member',
        dateOfBirth,
      });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('binds the stored calendar day to the edit picker', async () => {
    await loadEditMember([1980, 4, 30]);
    expect(fixture.nativeElement.querySelector('#family-dob-picker').value).toBe(
      '1980-04-30T00:00:00',
    );
    expect(fixture.nativeElement.querySelector('[slot="date-target"]')).toBeNull();
  });

  for (const absent of [undefined, null]) {
    it(`shows Not set for an edit with ${absent} DOB without fabricating a PUT date`, async () => {
      await loadEditMember(absent);
      const button = fixture.nativeElement.querySelector(
        'ion-datetime-button[datetime="family-dob-picker"]',
      );
      expect(button.querySelector('[slot="date-target"]')?.textContent ?? '').toContain(
        'CLIENTS.DATE_OF_BIRTH_NOT_SET',
      );
      expect(
        fixture.nativeElement.querySelector('[data-testid="clear-family-date-of-birth"]'),
      ).toBeNull();
      component.onSubmit();
      const request = http.expectOne(
        (request) => request.method === 'PUT' && request.url.endsWith('/clients/7/familymembers/8'),
      );
      expect(JSON.parse(request.request.serializeBody() as string)).not.toHaveProperty(
        'dateOfBirth',
      );
      request.flush({ resourceId: 8 });
    });
  }

  // Both shapes, because the OpenAPI document and the platform disagree about which one this
  // endpoint sends (#653) and the form has to read whichever arrives. Measured against a real
  // Fineract: it answers the string. Indexing that as [year, month, day] read its characters,
  // resolved to 2 December 1901, and an unchanged edit saved that over the real birth date.
  for (const dateOfBirth of [[1980, 4, 30], '1980-04-30'] as (number[] | string)[]) {
    it(`retains the saved DOB on an unchanged edit, given ${JSON.stringify(dateOfBirth)}`, async () => {
      await loadEditMember(dateOfBirth);
      expect(fixture.nativeElement.querySelector('#family-dob-picker').value).toBe(
        '1980-04-30T00:00:00',
      );
      component.onSubmit();
      const request = http.expectOne(
        (request) => request.method === 'PUT' && request.url.endsWith('/clients/7/familymembers/8'),
      );
      expect(request.request.body.dateOfBirth).toBe('30 April 1980');
      request.flush({ resourceId: 8 });
    });
  }

  it('updates the edit picker and existing payload after an explicit replacement', async () => {
    await loadEditMember([1980, 4, 30]);
    await chooseDate();
    expect(fixture.nativeElement.querySelector('#family-dob-picker').value).toBe(
      '1990-01-05T00:00:00',
    );
    component.onSubmit();
    const request = http.expectOne(
      (request) => request.method === 'PUT' && request.url.endsWith('/clients/7/familymembers/8'),
    );
    expect(request.request.body.dateOfBirth).toBe('05 January 1990');
    request.flush({ resourceId: 8 });
  });
});

/**
 * The add form's own guidance: which fields the platform insists on, which birth dates it will
 * accept, and what the operator is told once the save lands.
 */
describe('Family member form guidance', () => {
  let fixture: ComponentFixture<ClientFamilyMemberFormComponent>;
  let component: ClientFamilyMemberFormComponent;
  let http: HttpTestingController;
  let fakes: ReturnType<typeof provideFakeAdapters>;
  let navigate: ReturnType<typeof vi.fn>;

  /**
   * @param businessDate - the day the tenant is on, or `null` for a tenant without one.
   * @param arrange - runs against the fakes before the component is created.
   */
  async function setup(
    businessDate: string | null = null,
    arrange?: (adapters: typeof fakes) => void,
  ): Promise<void> {
    fakes = provideFakeAdapters();
    fakes.businessDate.businessDate = businessDate;
    arrange?.(fakes);
    navigate = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ClientFamilyMemberFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...fakes.providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'clientId' ? '7' : null) } },
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClientFamilyMemberFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith('/clients/7/familymembers/template'))
      .flush({
        relationshipIdOptions: [{ id: 1, name: 'Sibling' }],
      });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  /** Fills what the platform insists on: first name, last name and a relationship. */
  async function completeRequiredFields(): Promise<void> {
    const member = component.member();
    member.firstName = 'Asha';
    member.lastName = 'Kumar';
    member.relationshipId = 1;
    component.member.set({ ...member });
    // Twice: `ngModel` writes the model into its control on a microtask, so the first pass
    // renders the new values and the second recomputes the form's validity from them.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('marks the fields the platform insists on and names an empty one', async () => {
    await setup();

    expect(fixture.nativeElement.querySelectorAll('.required-marker').length).toBe(3);
    expect(query('[data-testid="family-first-name-error"]')).toBeNull();

    query('#family-first-name-input').dispatchEvent(new CustomEvent('ionBlur'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('[data-testid="family-first-name-error"]')).not.toBeNull();
    expect(query('[data-testid="family-first-name-error"]').getAttribute('role')).toBe('alert');
  });

  it('says why Save is out of reach, and stops saying it once the form is valid', async () => {
    await setup();

    expect(query('[data-testid="family-submit-hint"]')).not.toBeNull();
    expect(query('#family-submit-btn').disabled).toBe(true);

    await completeRequiredFields();

    expect(query('[data-testid="family-submit-hint"]')).toBeNull();
    expect(query('#family-submit-btn').disabled).toBe(false);
  });

  it("bounds the birth date at the tenant's day, not the browser's", async () => {
    // Fineract refuses a dateOfBirth later than its own business date, so an unbounded picker
    // offers days the platform will reject. A date far from any plausible run of this suite,
    // so a component that read `new Date()` instead could not pass by coincidence.
    await setup('2020-06-15');

    expect(component.maxDateOfBirth()).toBe('2020-06-15');
    // A property binding, not an attribute: `ion-datetime` declares `max`.
    expect(query('#family-dob-picker').max).toBe('2020-06-15');
  });

  it('does not create the picker until the platform has answered with its bound', async () => {
    // Created before the bound, the picker opened on the browser's month; see maxDateOfBirth.
    const enabled = new Subject<boolean>();
    await setup('2026-10-15', (adapters) =>
      vi.spyOn(adapters.businessDate, 'isBusinessDateEnabled').mockReturnValue(enabled),
    );

    expect(query('#family-dob-picker')).toBeNull();
    expect(query('ion-datetime-button')).toBeNull();

    enabled.next(true);
    enabled.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('#family-dob-picker').max).toBe('2026-10-15');
    expect(query('ion-datetime-button[datetime="family-dob-picker"]')).not.toBeNull();
  });

  it('falls back to the platform clock when no business date governs', async () => {
    await setup(null);

    expect(component.maxDateOfBirth()).toBe(TestBed.inject(PlatformDateService).today());
  });

  it('confirms a created member and returns to the client, not to the member', async () => {
    await setup();
    await completeRequiredFields();

    component.onSubmit();
    expect(component.isSaving()).toBe(true);
    http
      .expectOne(
        (request) => request.method === 'POST' && request.url.endsWith('/clients/7/familymembers'),
      )
      // The id Fineract answers with is the family member's, which is why the route cannot be
      // built from it: /clients/view/44 is somebody else's client.
      .flush({ clientId: 7, resourceId: 44 });
    await fixture.whenStable();

    expect(component.isSaving()).toBe(false);
    expect(fakes.overlay.lastToast?.message).toContain('FAMILY_MEMBER_ADDED');
    expect(navigate).toHaveBeenCalledWith(['/clients/view', 7]);
  });

  it('keeps the operator on the form when the platform refuses the save', async () => {
    await setup();
    await completeRequiredFields();

    component.onSubmit();
    http
      .expectOne(
        (request) => request.method === 'POST' && request.url.endsWith('/clients/7/familymembers'),
      )
      .flush(
        { errors: [{ defaultUserMessage: 'no' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    // Reported by the error interceptor, not from here; what matters at this level is that the
    // form is usable again rather than stuck behind a disabled Save.
    expect(component.isSaving()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
