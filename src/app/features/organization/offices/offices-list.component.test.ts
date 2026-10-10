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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfficesListComponent } from './offices-list.component';
import { OFFICE_API } from '../../../core/adapters';
import type { Office, OfficeApi } from '../../../core/adapters';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

/**
 * Offices in the application's own shape.
 *
 * `openingDate` is a plain ISO string here, where this spec previously wrote
 * `openingDate: [2026, 6, 16] as unknown as number[]` — a cast that existed because the
 * generated type declares `string` and Fineract sends `[year, month, day]`. The conversion now
 * happens once in `mapOffice`, and that disagreement is tested where it lives, in
 * `core/adapters/api/fineract-office.api.test.ts`. See issue #653.
 */
const HEAD_OFFICE: Office = {
  id: 1,
  name: 'Head Office',
  nameDecorated: 'Head Office',
  externalId: 'H1',
  hierarchy: '.',
  parentId: null,
  parentName: null,
  openingDate: '2026-06-16',
};

const BRANCH: Office = {
  id: 2,
  name: 'Branch Office',
  nameDecorated: '....Branch Office',
  externalId: 'B1',
  hierarchy: '.2.',
  parentId: 1,
  parentName: 'Head Office',
  openingDate: '2026-06-17',
};

describe('OfficesListComponent', () => {
  let component: OfficesListComponent;
  let fixture: ComponentFixture<OfficesListComponent>;
  let officeApiSpy: SpyObj<OfficeApi>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    officeApiSpy = createSpyObj(['list']);
    routerSpy = createSpyObj(['navigate']);

    officeApiSpy.list.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [OfficesListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfficesListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load offices list', () => {
    officeApiSpy.list.mockReturnValue(of([HEAD_OFFICE, BRANCH]));

    fixture.detectChanges();

    expect(component).toBeTruthy();
    // `true` is includeAllOffices, which widens the result past the user's own hierarchy.
    expect(officeApiSpy.list).toHaveBeenCalledWith(true);
    expect(component.offices()).toEqual([HEAD_OFFICE, BRANCH]);
  });

  it('renders the opening date without each screen re-interpreting it', () => {
    officeApiSpy.list.mockReturnValue(of([HEAD_OFFICE]));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2026-06-16');
  });

  it('shows a placeholder for an office with no opening date', () => {
    // The model says null; turning that into a dash is the view's job, not the model's.
    officeApiSpy.list.mockReturnValue(of([{ ...HEAD_OFFICE, openingDate: null }]));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('-');
  });

  it('should handle error when loading offices', () => {
    officeApiSpy.list.mockReturnValue(throwError(() => new Error('Error')));
    vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.offices()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('Failed to load offices', expect.any(Error));
  });

  it('should navigate to create office page', () => {
    component.onCreateOffice();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/organization/offices/create']);
  });

  it('should navigate to edit office page', () => {
    component.onEditOffice({ ...BRANCH, id: 45, name: 'Edit Office' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/organization/offices/edit', 45]);
  });
});
