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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';

import { OfficeFormComponent } from './office-form.component';
import { OFFICE_API } from '../../../core/adapters';
import type { Office } from '../../../core/adapters';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { asyncOf, renderComponent } from '../../../testing/render';

describe('OfficeFormComponent', () => {
  let component: OfficeFormComponent;
  let fixture: ComponentFixture<OfficeFormComponent>;
  let officeApiSpy: SpyObj<{
    list: (all?: boolean) => unknown;
    get: (id: number) => unknown;
    create: (draft: unknown) => unknown;
    update: (id: number, draft: unknown) => unknown;
  }>;

  /** `Office` as the adapter maps it — the opening date already an ISO string. */
  function office(overrides: Partial<Office>): Office {
    return {
      id: 1,
      name: 'Head Office',
      nameDecorated: 'Head Office',
      externalId: null,
      hierarchy: '.',
      parentId: null,
      parentName: null,
      openingDate: '2009-01-01',
      ...overrides,
    };
  }
  let routerSpy: SpyObj<Router>;
  let activatedRouteParams: Observable<unknown>;

  const OFFICES_PATH = '/organization/offices';
  const NEW_OFFICE = 'New Office';
  const TEST_OFFICE = 'Test Office';
  const TEST_OPENING_DATE = '2026-06-16';

  beforeEach(async () => {
    officeApiSpy = createSpyObj(['list', 'get', 'create', 'update']);

    routerSpy = createSpyObj(['navigate']);

    officeApiSpy.list.mockReturnValue(of([]) as unknown as Observable<never>);

    // The previous fixture wrote `openingDate: [2026, 6, 16] as unknown as number[]` to get a
    // realistic value past a type that declares `string`. The contract removes the need: the
    // date is an ISO string here because that is what the mapper produces.
    officeApiSpy.get.mockReturnValue(
      of(
        office({ id: 12, name: TEST_OFFICE, externalId: 'ext12', openingDate: TEST_OPENING_DATE }),
      ) as unknown as Observable<never>,
    );
    officeApiSpy.create.mockReturnValue(of(13) as unknown as Observable<never>);
    officeApiSpy.update.mockReturnValue(of(undefined) as unknown as Observable<never>);

    activatedRouteParams = of({
      get: () => null,
    });

    await TestBed.configureTestingModule({
      imports: [OfficeFormComponent],
      providers: [
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: activatedRouteParams,
          },
        },
        provideNoopAnimations(),
        ...provideTranslateTesting(),
      ],
    }).compileComponents();
  });

  describe('Create Mode', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(OfficeFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create and load offices', () => {
      expect(component).toBeTruthy();
      expect(officeApiSpy.list).toHaveBeenCalledWith(true);
      expect(component.isEditMode()).toBe(false);
    });

    it('should submit form in create mode', () => {
      component.office.set({
        name: NEW_OFFICE,
        parentId: 1,
        externalId: 'extNew',
      });

      component.openingDate.set('2026-06-15');

      component.onSubmit();

      expect(component.isSaving()).toBe(true);

      // No dateFormat and no locale: the adapter owns those. Asserting their absence is what
      // would catch them creeping back into the form.
      expect(officeApiSpy.create).toHaveBeenCalledWith({
        name: NEW_OFFICE,
        parentId: 1,
        externalId: 'extNew',
        openingDate: '2026-06-15',
      });

      expect(routerSpy.navigate).toHaveBeenCalledWith([OFFICES_PATH]);
    });

    it('should handle error in create mode', () => {
      officeApiSpy.create.mockReturnValue(
        throwError(() => new Error('Error')) as unknown as Observable<never>,
      );

      component.office.set({
        name: NEW_OFFICE,
      });

      component.onSubmit();

      expect(component.isSaving()).toBe(false);
    });

    it('should navigate away on cancel', () => {
      component.onCancel();

      expect(routerSpy.navigate).toHaveBeenCalledWith([OFFICES_PATH]);
    });
  });

  describe('Parent office dropdown', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
    });

    it('renders an option per office returned by the API', async () => {
      officeApiSpy.list.mockReturnValue(
        asyncOf([
          office({ id: 1, name: 'Head Office' }),
          office({ id: 2, name: 'Branch Office' }),
        ]) as unknown as Observable<never>,
      );

      const rendered = await renderComponent(OfficeFormComponent, {
        providers: [
          { provide: OFFICE_API, useValue: officeApiSpy },
          { provide: Router, useValue: routerSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of({
                get: () => null,
              }),
            },
          },
          provideNoopAnimations(),
          ...provideTranslateTesting(),
        ],
      });

      const options = rendered.nativeElement.querySelectorAll('ion-select-option');

      expect(
        Array.from(options).map((option) => (option as HTMLElement).textContent?.trim()),
      ).toEqual(['Head Office', 'Branch Office']);
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
    });

    it('should load office details and support update', async () => {
      const editParams = of({
        get: (key: string) => (key === 'id' ? '12' : null),
      });

      await TestBed.configureTestingModule({
        imports: [OfficeFormComponent],
        providers: [
          { provide: OFFICE_API, useValue: officeApiSpy },
          { provide: Router, useValue: routerSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: editParams,
            },
          },
          provideNoopAnimations(),
          ...provideTranslateTesting(),
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(OfficeFormComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();

      expect(component.isEditMode()).toBe(true);
      expect(component.officeId).toBe(12);

      expect(officeApiSpy.get).toHaveBeenCalledWith(12);

      expect(component.office().name).toBe(TEST_OFFICE);
      expect(component.openingDate()).toBe(TEST_OPENING_DATE);

      component.openingDate.set(TEST_OPENING_DATE);

      component.onSubmit();

      expect(officeApiSpy.update).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          name: TEST_OFFICE,
          openingDate: TEST_OPENING_DATE,
        }),
      );
    });
  });
});
