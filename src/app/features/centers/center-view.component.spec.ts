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
import { ActivatedRoute, Router } from '@angular/router';

import { BASE_PATH } from '../../api';
import { DialogService } from '../../core/services/dialog.service';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { CenterDetail } from './center-detail.model';
import { CenterViewComponent } from './center-view.component';

/** As `app.config.ts` computes it: the API url with the trailing `/v1` removed. */
const API = '/api';
const HEAD_OFFICE = 'Head Office';
const CENTER_NAME = 'Kibera Center';
const CENTER_URL = `${API}/v1/centers/4`;
const FINERACT_LOCALE = 'en';
const FINERACT_DATE_FORMAT = 'dd MMMM yyyy';
const WEEKLY_COLLECTION = 'Weekly collection';

const ACTIVE_CENTER: CenterDetail = {
  id: 4,
  accountNo: '000000004',
  name: CENTER_NAME,
  status: { id: 300, code: 'groupingStatusType.active', value: 'Active' },
  active: true,
  officeId: 1,
  officeName: HEAD_OFFICE,
  staffId: 2,
  staffName: 'Okoth, Grace',
  timeline: { activatedOnDate: [2026, 1, 15] },
  groupMembers: [
    {
      id: 5,
      accountNo: '000000005',
      name: 'Kibera Womens Group',
      status: { id: 300, value: 'Active' },
      officeName: HEAD_OFFICE,
    },
  ],
};

describe('CenterViewComponent', () => {
  let fixture: ComponentFixture<CenterViewComponent>;
  let component: CenterViewComponent;
  let http: HttpTestingController;
  let dialog: jasmine.SpyObj<DialogService>;
  let router: jasmine.SpyObj<Router>;

  function create(): void {
    fixture = TestBed.createComponent(CenterViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * Answers the center read and the calendar read that follows it, which every test needs before
   * it can assert anything.
   */
  function flushCenter(detail: CenterDetail = ACTIVE_CENTER, meetings: unknown[] = []): void {
    const request = http.expectOne((candidate) => candidate.url === CENTER_URL);
    expect(request.request.params.get('associations')).toBe('groupMembers');
    request.flush(detail);
    http.expectOne((candidate) => candidate.url === `${CENTER_URL}/calendars`).flush(meetings);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    dialog = jasmine.createSpyObj('DialogService', ['open', 'confirm']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    const adapters = provideFakeAdapters();

    await TestBed.configureTestingModule({
      imports: [CenterViewComponent],
      providers: [
        { provide: BASE_PATH, useValue: API },
        { provide: DialogService, useValue: dialog },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '4']]) } } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        // The datatables tab pulls in TranslateModule, which needs the library configured.
        ...provideTranslateTesting(),
        ...adapters.providers,
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * The read has to name the association. `associations=all` returns nothing extra on a center —
   * not even the group members — so a request without it would leave the groups tab empty by
   * construction rather than because the center has none.
   */
  it('reads the center with its groups and renders them', () => {
    create();
    flushCenter();

    expect(component.center()?.name).toBe(CENTER_NAME);
    expect(component.groupMembers()).toHaveSize(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="center-name"]').textContent,
    ).toContain('Kibera Center');
    expect(
      fixture.nativeElement.querySelector('[data-testid="center-group-count"]').textContent,
    ).toContain('1');
  });

  it('offers a retry rather than an empty page when the read fails', () => {
    create();
    http
      .expectOne((candidate) => candidate.url === CENTER_URL)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.loadFailed()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-testid="center-load-error"]')).not.toBeNull();
  });

  it('offers activate only while pending, and close only while active', () => {
    create();
    flushCenter({ ...ACTIVE_CENTER, status: { id: 100, value: 'Pending' }, active: false });

    expect(component.canActivate()).toBeTrue();
    expect(component.canClose()).toBeFalse();

    component.center.set(ACTIVE_CENTER);
    expect(component.canActivate()).toBeFalse();
    expect(component.canClose()).toBeTrue();

    component.center.set({ ...ACTIVE_CENTER, status: { id: 600, value: 'Closed' } });
    expect(component.isClosed()).toBeTrue();
    expect(component.canClose()).toBeFalse();
  });

  it('posts activate with the date the dialog returned', async () => {
    create();
    flushCenter({ ...ACTIVE_CENTER, status: { id: 100, value: 'Pending' } });

    dialog.open.and.resolveTo({ date: '2026-02-01T00:00:00.000Z' });
    await component.onAction('activate');

    const request = http.expectOne(
      (candidate) => candidate.url === CENTER_URL && candidate.method === 'POST',
    );
    expect(request.request.params.get('command')).toBe('activate');
    expect(request.request.body).toEqual({
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
      activationDate: '01 February 2026',
    });
    request.flush({});
    flushCenter();
  });

  it('posts close with the reason, which the platform requires', async () => {
    create();
    flushCenter();

    dialog.open.and.resolveTo({ date: '2026-03-02T00:00:00.000Z', closureReasonId: 9 });
    await component.onAction('close');

    const request = http.expectOne(
      (candidate) => candidate.url === CENTER_URL && candidate.method === 'POST',
    );
    expect(request.request.params.get('command')).toBe('close');
    expect(request.request.body).toEqual({
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
      closureDate: '02 March 2026',
      closureReasonId: 9,
    });
    request.flush({});
    flushCenter();
  });

  /**
   * Assignment is an update, not a command, and `name` is mandatory on it even though it is not
   * being changed — omitting it answers validation.msg.center.name.cannot.be.blank.
   */
  it('assigns staff through an update that carries the unchanged name', async () => {
    create();
    flushCenter();

    dialog.open.and.resolveTo({ staffId: 7 });
    await component.onAssignStaff();

    const request = http.expectOne(
      (candidate) => candidate.url === CENTER_URL && candidate.method === 'PUT',
    );
    expect(request.request.body).toEqual({
      name: CENTER_NAME,
      staffId: 7,
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    });
    request.flush({});
    flushCenter();
  });

  /**
   * There is no center-side unassign: the update ignores `staffId: null` and rejects `-1`. Only
   * the groups resource accepts it, and it refuses `locale`/`dateFormat` as unsupported, so the
   * body carries the staff id alone.
   */
  it('unassigns staff through the groups resource with a bare payload', async () => {
    create();
    flushCenter();

    dialog.confirm.and.resolveTo(true);
    await component.onUnassignStaff();

    const request = http.expectOne(
      (candidate) => candidate.url === `${API}/v1/groups/4` && candidate.method === 'POST',
    );
    expect(request.request.params.get('command')).toBe('unassignStaff');
    expect(request.request.body).toEqual({ staffId: 2 });
    request.flush({});
    flushCenter();
  });

  it('does not unassign staff when the confirmation is declined', async () => {
    create();
    flushCenter();

    dialog.confirm.and.resolveTo(false);
    await component.onUnassignStaff();

    http.expectNone((candidate) => candidate.method === 'POST');
  });

  it('attaches and detaches groups through their own commands', async () => {
    create();
    flushCenter();

    dialog.open.and.resolveTo({ groupMembers: [11, 12] });
    await component.onManageGroups('add');

    const attach = http.expectOne(
      (candidate) => candidate.url === CENTER_URL && candidate.method === 'POST',
    );
    expect(attach.request.params.get('command')).toBe('associateGroups');
    expect(attach.request.body).toEqual({ groupMembers: [11, 12] });
    attach.flush({});
    flushCenter();

    dialog.open.and.resolveTo({ groupMembers: [5] });
    await component.onManageGroups('remove');

    const detach = http.expectOne(
      (candidate) => candidate.url === CENTER_URL && candidate.method === 'POST',
    );
    expect(detach.request.params.get('command')).toBe('disassociateGroups');
    detach.flush({});
    flushCenter();
  });

  it('shows the meeting, and offers scheduling only once the center is active', () => {
    create();
    flushCenter({ ...ACTIVE_CENTER, status: { id: 100, value: 'Pending' } });
    expect(component.canScheduleMeeting()).toBeFalse();

    component.center.set(ACTIVE_CENTER);
    component.meeting.set({
      id: 3,
      title: WEEKLY_COLLECTION,
      frequency: { id: 2, value: 'WEEKLY' },
    });
    expect(component.canScheduleMeeting()).toBeTrue();
    expect(component.meetingSummary()).toBe(`${WEEKLY_COLLECTION} (WEEKLY)`);
  });

  /**
   * A weekly meeting must name its day: the platform refuses one without `repeatsOnDay`. The
   * field is omitted entirely for other frequencies, which reject it.
   */
  it('posts a new weekly meeting with the day it repeats on', async () => {
    create();
    flushCenter();

    dialog.open.and.resolveTo({
      title: WEEKLY_COLLECTION,
      startDate: '2026-04-06T00:00:00.000Z',
      frequency: 2,
      interval: 1,
      typeId: 1,
      repeatsOnDay: 1,
    });
    await component.onScheduleMeeting();

    const request = http.expectOne(
      (candidate) => candidate.url === `${CENTER_URL}/calendars` && candidate.method === 'POST',
    );
    expect(request.request.body).toEqual({
      title: WEEKLY_COLLECTION,
      startDate: '06 April 2026',
      frequency: 2,
      interval: 1,
      typeId: 1,
      repeating: true,
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
      repeatsOnDay: 1,
    });
    request.flush({});
    flushCenter();
  });

  it('updates the existing meeting rather than creating a second one', async () => {
    create();
    flushCenter(ACTIVE_CENTER, [{ id: 3, title: WEEKLY_COLLECTION }]);

    dialog.open.and.resolveTo({
      title: 'Fortnightly collection',
      startDate: '2026-04-06T00:00:00.000Z',
      frequency: 1,
      interval: 2,
      typeId: 1,
    });
    await component.onScheduleMeeting();

    const request = http.expectOne(
      (candidate) => candidate.url === `${CENTER_URL}/calendars/3` && candidate.method === 'PUT',
    );
    // No `repeatsOnDay`: it is meaningful only for a weekly meeting.
    expect(request.request.body['repeatsOnDay']).toBeUndefined();
    expect(request.request.body['interval']).toBe(2);
    request.flush({});
    flushCenter();
  });

  it('sends nothing when a dialog is dismissed', async () => {
    create();
    flushCenter();

    dialog.open.and.resolveTo(undefined);
    await component.onAction('close');
    await component.onAssignStaff();
    await component.onManageGroups('add');

    http.expectNone((candidate) => candidate.method === 'POST');
    http.expectNone((candidate) => candidate.method === 'PUT');
  });
});
