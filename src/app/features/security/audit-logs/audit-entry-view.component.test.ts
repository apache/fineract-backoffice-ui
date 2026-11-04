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

import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { AUDIT_API, type AuditApi, type AuditEntry } from '../../../core/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { MASK } from './audit-payload';
import { AuditEntryViewComponent } from './audit-entry-view.component';

const ENTRY: AuditEntry = {
  id: 12_873,
  actionName: 'CREATE',
  entityName: 'USER',
  resourceId: 31,
  subresourceId: null,
  maker: 'officer1',
  madeOnDate: '2026-10-15T10:42:00Z',
  checker: 'manager2',
  checkedOnDate: '2026-10-15T11:05:00Z',
  processingResult: 'processed',
  officeId: 1,
  officeName: 'Main Office',
  groupId: null,
  groupName: '',
  clientId: 88,
  clientName: 'Ada Lovelace',
  loanId: 457,
  loanAccountNo: '000000457',
  savingsAccountId: null,
  savingsAccountNo: '',
  commandAsJson: '{"username":"teller1","password":"S3cret!pass","repeatPassword":"S3cret!pass"}',
};

describe('AuditEntryViewComponent', () => {
  let fixture: ComponentFixture<AuditEntryViewComponent>;
  let api: SpyObj<AuditApi>;

  async function create(auditId = '12873'): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AuditEntryViewComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        provideRouter([]),
        { provide: AUDIT_API, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ auditId }) } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AuditEntryViewComponent);
    fixture.detectChanges();
  }

  const query = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${CSS.escape(testId)}"]`);

  beforeEach(() => {
    api = createSpyObj<AuditApi>(['list', 'get', 'searchTemplate']);
    api.get.mockReturnValue(of(ENTRY));
  });

  it('reads the entry named in the route', async () => {
    await create();

    expect(api.get).toHaveBeenCalledWith(12_873);
    expect(query('audit-entry-maker')?.textContent).toContain('officer1');
    expect(query('audit-entry-checker')?.textContent).toContain('manager2');
  });

  it('shows the payload pretty-printed with every password masked', async () => {
    await create();

    const payload = query('audit-entry-payload')!.textContent!;
    expect(payload).not.toContain('S3cret!pass');
    expect(payload).toContain(`"password": "${MASK}"`);
    expect(payload).toContain(`"repeatPassword": "${MASK}"`);
    expect(payload).toContain('"username": "teller1"');
  });

  it('keeps the secret out of the whole page, not just the payload block', async () => {
    await create();

    expect(fixture.nativeElement.textContent).not.toContain('S3cret!pass');
  });

  it('links each record the command touched to its own screen', async () => {
    await create();

    expect(query('audit-link-office')?.getAttribute('href')).toBe('/organization/offices/view/1');
    expect(query('audit-link-client')?.getAttribute('href')).toBe('/clients/view/88');
    expect(query('audit-link-client')?.textContent).toContain('Ada Lovelace');
    expect(query('audit-link-loan')?.getAttribute('href')).toBe('/loans/view/457');
    expect(query('audit-link-group')).toBeNull();
    expect(query('audit-link-savings')).toBeNull();
  });

  it('links savings accounts and groups when Fineract sends their ids', async () => {
    api.get.mockReturnValue(
      of({ ...ENTRY, groupId: 4, groupName: 'Weavers', savingsAccountId: 9, savingsAccountNo: '' }),
    );
    await create();

    expect(query('audit-link-group')?.getAttribute('href')).toBe('/groups/view/4');
    expect(query('audit-link-savings')?.getAttribute('href')).toBe(
      '/products/savings-accounts/view/9',
    );
    // No account number came back, so the link falls back to the id.
    expect(query('audit-link-savings')?.textContent).toContain('#9');
  });

  it('shows names an older Fineract sends without ids, as text rather than links', async () => {
    // Before FINERACT-2186 the entry carries officeName, groupName and savingsAccountNo only.
    api.get.mockReturnValue(
      of({
        ...ENTRY,
        officeId: null,
        officeName: 'Main Office',
        groupName: 'Weavers',
        savingsAccountNo: '000000009',
      }),
    );
    await create();

    for (const [testId, text] of [
      ['audit-link-office', 'Main Office'],
      ['audit-link-group', 'Weavers'],
      ['audit-link-savings', '000000009'],
    ]) {
      const element = query(testId);
      expect(element?.textContent).toContain(text);
      expect(element?.tagName).toBe('SPAN');
    }
  });

  it('opens a centre on the centre screen, not the group screen', async () => {
    api.get.mockReturnValue(of({ ...ENTRY, entityName: 'CENTER', groupId: 6, groupName: 'East' }));
    await create();

    expect(query('audit-link-group')?.getAttribute('href')).toBe('/centers/view/6');
  });

  it('names the payload region by its heading', async () => {
    await create();

    const payload = query('audit-entry-payload')!;
    expect(payload.getAttribute('role')).toBe('region');
    const heading = fixture.nativeElement.querySelector(
      `#${payload.getAttribute('aria-labelledby')}`,
    );
    expect(heading?.textContent).toContain('AUDIT.PAYLOAD');
  });

  it('lets a retry replace a read still in flight', async () => {
    const first = new Subject<AuditEntry>();
    api.get.mockReturnValueOnce(first);
    await create();

    api.get.mockReturnValue(of({ ...ENTRY, maker: 'retried' }));
    fixture.componentInstance.load();
    first.next({ ...ENTRY, maker: 'stale' });
    fixture.detectChanges();

    expect(fixture.componentInstance.entry()?.maker).toBe('retried');
  });

  it.each([
    ['FIXEDDEPOSITACCOUNT', '/products/fixed-deposits/view/9'],
    ['RECURRINGDEPOSITACCOUNT', '/products/recurring-deposits/view/9'],
    ['SAVINGSACCOUNT', '/products/savings-accounts/view/9'],
  ])('opens a %s entry on its own account screen', async (entityName, href) => {
    api.get.mockReturnValue(of({ ...ENTRY, entityName, savingsAccountId: 9 }));
    await create();

    expect(query('audit-link-savings')?.getAttribute('href')).toBe(href);
  });

  it('says so when the entry has no payload', async () => {
    api.get.mockReturnValue(of({ ...ENTRY, commandAsJson: null }));
    await create();

    expect(query('audit-entry-payload')).toBeNull();
    expect(query('audit-entry-no-payload')).not.toBeNull();
  });

  it.each([
    [403, 'forbidden'],
    [404, 'not-found'],
    [500, 'failed'],
  ])('reports a %s as %s', async (status, expected) => {
    api.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    await create();

    expect(fixture.componentInstance.loadError()).toBe(expected);
    expect(query('audit-entry-load-error')).not.toBeNull();
    expect(query('audit-entry-payload')).toBeNull();
  });

  it('does not ask the server for an id that is not a number', async () => {
    await create('abc');

    expect(api.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loadError()).toBe('not-found');
  });
});
