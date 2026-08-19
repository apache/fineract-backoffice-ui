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
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LoanUndoApprovalDialogComponent } from './loan-undo-approval-dialog.component';
import { provideFakeAdapters, FakeOverlayAdapter } from '../../testing/adapters';

describe('LoanUndoApprovalDialogComponent', () => {
  let fixture: ComponentFixture<LoanUndoApprovalDialogComponent>;
  let component: LoanUndoApprovalDialogComponent;
  let overlay: FakeOverlayAdapter;

  beforeEach(async () => {
    const adapters = provideFakeAdapters();
    overlay = adapters.overlay;

    await TestBed.configureTestingModule({
      imports: [LoanUndoApprovalDialogComponent],
      providers: [provideNoopAnimations(), ...adapters.providers],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanUndoApprovalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('dismisses with an empty body when no reason was given', () => {
    component.onConfirm();

    // Not `{ note: '' }`. The platform rejects unknown and empty parameters on this command,
    // and an empty note is not a reason — it is the absence of one.
    expect(overlay.dismissals).toEqual([{}]);
  });

  it('trims the reason and sends it as `note`', () => {
    component.note.set('  approved against the wrong client  ');

    component.onConfirm();

    expect(overlay.dismissals).toEqual([{ note: 'approved against the wrong client' }]);
  });

  it('treats a whitespace-only reason as no reason', () => {
    component.note.set(' '.repeat(3));

    component.onConfirm();

    expect(overlay.dismissals).toEqual([{}]);
  });

  it('dismisses with nothing at all when cancelled, so the caller sends no command', () => {
    component.onCancel();

    expect(overlay.dismissals).toEqual([undefined]);
  });
});
