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
import { OfficeFormComponent } from './office-form.component';
import { OfficesService } from '../../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { asyncOf, renderComponent } from '../../../testing/render';

describe('OfficeFormComponent', () => {
  let component: OfficeFormComponent;
  let fixture: ComponentFixture<OfficeFormComponent>;
  let officesServiceSpy: SpyObj<OfficesService>;
  let routerSpy: SpyObj<Router>;
  let activatedRouteParams: Observable<unknown>;

  const OFFICES_PATH = '/organization/offices';
  const NEW_OFFICE = 'New Office';
  const TEST_OFFICE = 'Test Office';
  const TEST_OPENING_DATE = '2026-06-16';

  beforeEach(async () => {
    officesServiceSpy = createSpyObj([
      'getOffices',
      'getOfficesOfficeId',
      'putOfficesOfficeId',
      'postOffices',
    ]);
    routerSpy = createSpyObj(['navigate']);

    officesServiceSpy.getOffices.mockReturnValue(of([]) as unknown as Observable<never>);
    officesServiceSpy.getOfficesOfficeId.mockReturnValue(
      of({
        id: 12,
        name: TEST_OFFICE,
        externalId: 'ext12',
        openingDate: [2026, 6, 16] as unknown as number[],
      }) as unknown as Observable<never>,
    );

    activatedRouteParams = of({
      get: () => null,
    });

    await TestBed.configureTestingModule({
      imports: [OfficeFormComponent, provideTranslateTesting()],
      providers: [
        { provide: OfficesService, useValue: officesServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: activatedRouteParams,
          },
        },
        provideNoopAnimations(),
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
      expect(officesServiceSpy.getOffices).toHaveBeenCalledWith(true);
      expect(component.isEditMode()).toBe(false);
    });

    it('should submit form in create mode', () => {
      officesServiceSpy.postOffices.mockReturnValue(of({}) as unknown as Observable<never>);
      component.office.set({
        name: NEW_OFFICE,
        parentId: 1,
        externalId: 'extNew',
      });
      component.openingDate.set('2026-06-15');

      component.onSubmit();

      expect(component.isSaving()).toBe(true);
      expect(officesServiceSpy.postOffices).toHaveBeenCalledWith({
        name: NEW_OFFICE,
        parentId: 1,
        externalId: 'extNew',
        openingDate: '2026-06-15',
        dateFormat: 'yyyy-MM-dd',
        locale: 'en',
      });
      expect(routerSpy.navigate).toHaveBeenCalledWith([OFFICES_PATH]);
    });

    it('should handle error in create mode', () => {
      officesServiceSpy.postOffices.mockReturnValue(
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
    // renderComponent configures its own module, so drop the one the outer beforeEach built.
    beforeEach(() => TestBed.resetTestingModule());

    // The rest of this file asserts on the component instance, which holds the right value
    // whether or not Angular was told about it. This one asserts on the DOM, with a mock that
    // emits a macrotask later like a real response does, so it fails if `offices` is assigned
    // without notifying Angular — the reason API-fed dropdowns render empty in the app.
    it('renders an option per office returned by the API', async () => {
      officesServiceSpy.getOffices.mockReturnValue(
        asyncOf([
          { id: 1, name: 'Head Office' },
          { id: 2, name: 'Branch Office' },
        ]) as unknown as Observable<never>,
      );

      const rendered = await renderComponent(OfficeFormComponent, {
        imports: [provideTranslateTesting()],
        providers: [
          { provide: OfficesService, useValue: officesServiceSpy },
          { provide: Router, useValue: routerSpy },
          { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => null }) } },
          provideNoopAnimations(),
        ],
      });

      const options = rendered.nativeElement.querySelectorAll('ion-select-option');
      expect(Array.from(options).map((o) => (o as HTMLElement).textContent?.trim())).toEqual([
        'Head Office',
        'Branch Office',
      ]);
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      // Re-configure module to provide activated route parameter for edit mode
      TestBed.resetTestingModule();
    });

    it('should load office details and support update', async () => {
      const editParams = of({
        get: (key: string) => (key === 'id' ? '12' : null),
      });

      await TestBed.configureTestingModule({
        imports: [OfficeFormComponent, provideTranslateTesting()],
        providers: [
          { provide: OfficesService, useValue: officesServiceSpy },
          { provide: Router, useValue: routerSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: editParams,
            },
          },
          provideNoopAnimations(),
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(OfficeFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isEditMode()).toBe(true);
      expect(component.officeId).toBe(12);
      expect(officesServiceSpy.getOfficesOfficeId).toHaveBeenCalledWith(12);
      expect(component.office().name).toBe(TEST_OFFICE);
      expect(component.openingDate()).toBe(TEST_OPENING_DATE);

      officesServiceSpy.putOfficesOfficeId.mockReturnValue(of({}) as unknown as Observable<never>);
      component.openingDate.set(TEST_OPENING_DATE);
      component.onSubmit();

      expect(officesServiceSpy.putOfficesOfficeId).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          name: TEST_OFFICE,
          openingDate: TEST_OPENING_DATE,
        }),
      );
    });
  });
});
