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
import { TellerFormComponent } from './teller-form.component';
import { OFFICE_API, TELLER_API, type Teller } from '../../core/adapters';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

/** A teller as the adapter maps it. `startDate` is the platform's own ISO date. */
const MAIN_TELLER: Teller = {
  id: 1,
  name: 'Main Teller',
  description: 'Head office vault',
  officeId: 1,
  officeName: 'Head Office',
  status: 'ACTIVE',
  startDate: '2026-10-02',
};

describe('TellerFormComponent, creating', () => {
  let component: TellerFormComponent;
  let fixture: ComponentFixture<TellerFormComponent>;
  let tellerApiSpy: SpyObj<{
    get: (id: number) => unknown;
    create: (d: unknown) => unknown;
    update: (id: number, u: unknown) => unknown;
  }>;
  let officeApiSpy: SpyObj<{ list: (all?: boolean) => unknown }>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    tellerApiSpy = createSpyObj(['get', 'create', 'update']);
    tellerApiSpy.create.mockReturnValue(of(undefined));
    officeApiSpy = createSpyObj(['list']);
    officeApiSpy.list.mockReturnValue(of([]));
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [TellerFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: routerSpy },
        // No id: the form is in create mode.
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TellerFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load offices on init, as the whole list including inactive ones', () => {
    expect(officeApiSpy.list).toHaveBeenCalledWith(true);
  });

  it('submits the name, office, status and start date the form holds', () => {
    component.teller.set({ name: 'Test Teller', officeId: 1, status: 'ACTIVE' });
    component.startDate = new Date(2026, 4, 9);

    component.onSubmit();

    expect(tellerApiSpy.create).toHaveBeenCalledWith({
      name: 'Test Teller',
      officeId: 1,
      status: 'ACTIVE',
      startDate: '2026-05-09',
    });
    expect(tellerApiSpy.update).not.toHaveBeenCalled();
  });

  it('returns to the list after a successful create', () => {
    component.teller.set({ name: 'Test Teller', officeId: 1, status: 'ACTIVE' });

    component.onSubmit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tellers']);
  });
});

describe('TellerFormComponent, editing', () => {
  let component: TellerFormComponent;
  let fixture: ComponentFixture<TellerFormComponent>;
  let tellerApiSpy: SpyObj<{
    get: (id: number) => unknown;
    create: (d: unknown) => unknown;
    update: (id: number, u: unknown) => unknown;
  }>;
  let officeApiSpy: SpyObj<{ list: (all?: boolean) => unknown }>;

  beforeEach(async () => {
    tellerApiSpy = createSpyObj(['get', 'create', 'update']);
    tellerApiSpy.get.mockReturnValue(of(MAIN_TELLER));
    tellerApiSpy.update.mockReturnValue(of(undefined));
    officeApiSpy = createSpyObj(['list']);
    officeApiSpy.list.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [TellerFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: createSpyObj(['navigate']) },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TellerFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the teller it was opened for', () => {
    expect(tellerApiSpy.get).toHaveBeenCalledWith(1);
    expect(component.teller()).toEqual({
      name: 'Main Teller',
      officeId: 1,
      description: 'Head office vault',
      status: 'ACTIVE',
    });
  });

  /**
   * The regression this block exists for.
   *
   * The form used to read the start date as a `[y, m, d]` array. For `'2026-10-02'` that built
   * 1901-12-02, and the update saved it: editing any teller silently moved its start date back
   * more than a century. The update must send back the date the teller already has.
   */
  it('saves the start date the teller already has, not a date rebuilt from it', () => {
    component.onSubmit();

    expect(tellerApiSpy.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'Main Teller', status: 'ACTIVE', startDate: '2026-10-02' }),
    );
    expect(tellerApiSpy.create).not.toHaveBeenCalled();
  });

  it('keeps the teller without an office on update, since the picker is disabled', () => {
    component.onSubmit();

    // An update has no office to send: the picker is disabled in edit mode and the platform is
    // not asked to move a teller between offices.
    const update = tellerApiSpy.update.mock.lastCall![1] as Record<string, unknown>;
    expect('officeId' in update).toBe(false);
  });
});
