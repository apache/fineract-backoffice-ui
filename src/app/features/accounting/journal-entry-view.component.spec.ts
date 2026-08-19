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
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { JournalEntryViewComponent } from './journal-entry-view.component';
import { JournalEntriesService, JournalEntryTransactionItem } from '../../api';
import { DialogService } from '../../core/services/dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { provideFakeAdapters } from '../../testing/adapters';

/** A journal line as the platform returns it — entryType and manualEntry decide what is allowed. */
function line(overrides: Partial<JournalEntryTransactionItem> = {}): JournalEntryTransactionItem {
  return {
    id: 1,
    transactionId: 'a28401fa55fb',
    officeName: 'Head Office',
    manualEntry: true,
    reversed: false,
    amount: 100,
    entryType: { id: 1, value: 'DEBIT' },
    ...overrides,
  } as JournalEntryTransactionItem;
}

describe('JournalEntryViewComponent', () => {
  let component: JournalEntryViewComponent;
  let fixture: ComponentFixture<JournalEntryViewComponent>;
  let journalSpy: jasmine.SpyObj<JournalEntriesService>;
  let dialogSpy: jasmine.SpyObj<DialogService>;

  function build(entry: JournalEntryTransactionItem, siblings: JournalEntryTransactionItem[]) {
    journalSpy.getJournalentriesJournalEntryId.and.returnValue(
      of(entry) as unknown as Observable<never>,
    );
    journalSpy.getJournalentries.and.returnValue(
      of({ pageItems: siblings }) as unknown as Observable<never>,
    );
    fixture = TestBed.createComponent(JournalEntryViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    journalSpy = jasmine.createSpyObj('JournalEntriesService', [
      'getJournalentriesJournalEntryId',
      'getJournalentries',
      'postJournalentriesTransactionId',
    ]);
    dialogSpy = jasmine.createSpyObj('DialogService', ['confirm']);

    await TestBed.configureTestingModule({
      imports: [JournalEntryViewComponent],
      providers: [
        { provide: JournalEntriesService, useValue: journalSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: NotificationService, useValue: jasmine.createSpyObj('N', ['success', 'error']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '1']]) } } },
        ...provideFakeAdapters().providers,
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  it('shows the whole transaction, not only the line that was clicked', () => {
    build(line(), [line({ id: 1 }), line({ id: 2, entryType: { id: 2, value: 'CREDIT' } })]);

    expect(component.debits()).toHaveSize(1);
    expect(component.credits()).toHaveSize(1);
    expect(component.debitTotal()).toBe(100);
    expect(component.creditTotal()).toBe(100);
  });

  it('treats the transaction as reversed when any of its lines is', () => {
    build(line(), [line({ id: 1 }), line({ id: 2, reversed: true })]);

    expect(component.isReversed()).toBeTrue();
  });

  it('reverses the transaction, not the line, once confirmed', async () => {
    build(line(), [line()]);
    dialogSpy.confirm.and.resolveTo(true);
    journalSpy.postJournalentriesTransactionId.and.returnValue(
      of({ transactionId: 'a28401fa7347' }) as unknown as Observable<never>,
    );

    await component.onReverse();

    expect(journalSpy.postJournalentriesTransactionId).toHaveBeenCalledWith(
      'a28401fa55fb',
      'reverse',
      {},
    );
  });

  it('does not reverse when the confirmation is declined', async () => {
    build(line(), [line()]);
    dialogSpy.confirm.and.resolveTo(false);

    await component.onReverse();

    expect(journalSpy.postJournalentriesTransactionId).not.toHaveBeenCalled();
  });

  it('offers no reversal for an entry the platform wrote itself, and says why', () => {
    // Covered here rather than end to end: producing a system-generated entry needs a portfolio
    // transaction with accounting attached, and a spec that opens whichever entry happens to be
    // first instead depends on what the rest of the suite has posted.
    build(line({ manualEntry: false }), [line({ manualEntry: false })]);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('journal-entry-system-note');
    expect(html).not.toContain('journal-entry-reverse');
  });

  it('offers no reversal once the transaction is reversed', () => {
    build(line({ reversed: true }), [line({ reversed: true })]);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('journal-entry-reversed');
    expect(html).not.toContain('journal-entry-reverse"');
  });

  it('falls back to the single line when the transaction lookup fails', () => {
    journalSpy.getJournalentriesJournalEntryId.and.returnValue(
      of(line()) as unknown as Observable<never>,
    );
    journalSpy.getJournalentries.and.returnValue(
      new Observable((subscriber) => subscriber.error(new Error('boom'))),
    );

    fixture = TestBed.createComponent(JournalEntryViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.lines()).toHaveSize(1);
    expect(component.isLoading()).toBeFalse();
  });
});
