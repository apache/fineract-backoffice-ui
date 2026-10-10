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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { GroupViewComponent } from './group-view.component';
import { GroupDetail } from './group-detail.model';
import { BASE_PATH, GroupsService } from '../../api';
import { provideFakeAdapters, FakeOverlayAdapter } from '../../testing/adapters';

/**
 * As `app.config.ts` computes it: the configured API url with a trailing `/v1` removed, since
 * the generated services prepend their own version segment. Using `/api/v1` here would let a
 * call site that forgot the `/v1` pass this spec and 404 in the browser.
 */
const API = '/api';
const HEAD_OFFICE = 'Head Office';
const AMINA = 'Amina Yusuf';

/** An active group with one member and one committee role, as the platform returns it. */
const GROUP: GroupDetail = {
  id: 7,
  accountNo: '000000007',
  name: 'Kibera Womens Group',
  status: { id: 300, code: 'clientStatusType.active', value: 'Active' },
  active: true,
  activationDate: [2026, 1, 15],
  officeId: 1,
  officeName: HEAD_OFFICE,
  staffId: 4,
  staffName: 'Okoth, Grace',
  clientMembers: [
    {
      id: 11,
      accountNo: '000000011',
      displayName: AMINA,
      status: { id: 300, value: 'Active' },
      officeName: HEAD_OFFICE,
    },
    {
      id: 12,
      accountNo: '000000012',
      displayName: 'Beatrice Wanjiru',
      status: { id: 100, value: 'Pending' },
      officeName: HEAD_OFFICE,
    },
  ],
  // Deliberately only one of the two. The screen must not read this list.
  activeClientMembers: [{ id: 11, displayName: AMINA }],
  groupRoles: [{ id: 3, role: { id: 13, name: 'Leader' }, clientId: 11, clientName: AMINA }],
  timeline: { submittedOnDate: [2026, 1, 1] },
};

describe('GroupViewComponent', () => {
  let fixture: ComponentFixture<GroupViewComponent>;
  let component: GroupViewComponent;
  let httpMock: HttpTestingController;
  let groupsService: SpyObj<GroupsService>;
  let overlay: FakeOverlayAdapter;

  beforeEach(async () => {
    groupsService = createSpyObj(['postGroupsGroupId', 'getGroupsTemplate']);
    groupsService.postGroupsGroupId.mockReturnValue(of({}) as never);
    groupsService.getGroupsTemplate.mockReturnValue(of({}) as never);

    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;

    await TestBed.configureTestingModule({
      imports: [GroupViewComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...adapters.providers,
        { provide: BASE_PATH, useValue: API },
        { provide: GroupsService, useValue: groupsService },
        { provide: Router, useValue: createSpyObj(['navigate']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '7' } } } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Answers the outstanding group fetch and asserts it asked for the associations. */
  function flushGroup(body: GroupDetail = GROUP): void {
    const request = httpMock.expectOne((req) => req.url === `${API}/v1/groups/7`);
    expect(request.request.params.get('associations')).toBe('all');
    request.flush(body);
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('requests the group with its associations', () => {
    flushGroup();
    expect(component.group()?.name).toBe('Kibera Womens Group');
  });

  it('lists every member, not only the active ones', () => {
    flushGroup();

    // `activeClientMembers` holds one of the two. A pending member that the officer cannot see
    // is a member they cannot chase, and the count would disagree with what may be removed.
    expect(component.members().map((member) => member.id)).toEqual([11, 12]);
  });

  it('offers a retry rather than an empty group when the load fails', () => {
    httpMock
      .expectOne((req) => req.url === `${API}/v1/groups/7`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(component.group()).toBeNull();
    const error = fixture.nativeElement.querySelector('[data-testid="group-load-error"]');
    expect(error).not.toBeNull();
  });

  it('sends the closure reason and a Fineract-formatted date when closing', async () => {
    flushGroup();

    overlay.nextModalResult = { actionDate: '2026-03-09', closureReasonId: 42 };
    await component.onClose();

    const [groupId, body, command] = groupsService.postGroupsGroupId.mock.lastCall!;
    expect(groupId).toBe(7);
    expect(command).toBe('close');
    expect(body).toEqual(
      expect.objectContaining({
        // Zero-padded: Fineract parses strictly against `dd MMMM yyyy` and a bare '9' 500s.
        closureDate: '09 March 2026',
        closureReasonId: 42,
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      }),
    );

    // The command's effects reach past the field it names, so the screen re-reads rather than
    // patching its copy.
    flushGroup();
  });

  it('names the assignment, not the role, when unassigning a committee role', async () => {
    flushGroup();

    overlay.nextModalResult = true; // the confirmation
    await component.onUnassignRole(component.roles()[0]);

    const [groupId, , command, roleId] = groupsService.postGroupsGroupId.mock.lastCall!;
    expect(groupId).toBe(7);
    expect(command).toBe('unassignRole');
    // 3 is the assignment id; 13 is the role's code-value id. Sending 13 answers 404 for a
    // "group role" that plainly exists, so the distinction is worth pinning down.
    expect(roleId).toBe(3);

    flushGroup();
  });

  it('passes the group office and current members to the add-member dialog', async () => {
    flushGroup();

    overlay.nextModalResult = undefined; // dismissed without a selection
    await component.onAddMembers();

    const request = overlay.modals.at(-1);
    expect(request?.inputs?.['data']).toEqual(
      expect.objectContaining({ mode: 'add', officeId: 1 }),
    );
    // Without the exclusion the dialog offers a client who is already in the group, and the
    // platform rejects associating them twice.
    const data = request?.inputs?.['data'] as { members: { id?: number }[] };
    expect(data.members.map((member) => member.id)).toEqual([11, 12]);
    expect(groupsService.postGroupsGroupId).not.toHaveBeenCalled();
  });

  it('gates the lifecycle actions on the status id', () => {
    flushGroup({ ...GROUP, status: { id: 100, value: 'Pending' } });

    expect(component.isPending()).toBe(true);
    expect(component.isActive()).toBe(false);
    expect(component.isClosed()).toBe(false);
  });

  describe('teardown', () => {
    it('dismisses popovers when destroyed', () => {
      flushGroup();

      const withPopovers = component as unknown as {
        popovers: () => readonly { dismiss: () => Promise<boolean> }[];
      };
      const popovers = withPopovers.popovers();
      expect(popovers.length).toBeGreaterThan(0);
      const dismissSpies = popovers.map((popover) =>
        vi.spyOn(popover, 'dismiss').mockResolvedValue(true),
      );

      fixture.destroy();

      for (const spy of dismissSpies) {
        expect(spy).toHaveBeenCalled();
      }
    });
  });
});
