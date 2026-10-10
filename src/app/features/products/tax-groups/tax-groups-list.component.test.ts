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
import { TaxGroupsListComponent } from './tax-groups-list.component';
import { TaxGroupService, GetTaxesGroupResponse } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('TaxGroupsListComponent', () => {
  let component: TaxGroupsListComponent;
  let fixture: ComponentFixture<TaxGroupsListComponent>;
  let serviceSpy: SpyObj<TaxGroupService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getTaxesGroup']);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getTaxesGroup.mockReturnValue(
      of([
        { id: 1, name: 'Standard', taxAssociations: [{ taxComponent: { id: 1, name: 'VAT' } }] },
      ]) as unknown as ReturnType<TaxGroupService['getTaxesGroup']>,
    );

    await TestBed.configureTestingModule({
      imports: [TaxGroupsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: TaxGroupService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaxGroupsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load tax groups on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getTaxesGroup).toHaveBeenCalled();
    expect(component.groups()).toHaveLength(1);
  });

  it('should join component names for display', () => {
    expect(
      component.componentNames({
        taxAssociations: [
          { taxComponent: { name: 'VAT' } },
          { taxComponent: { name: 'Cess' } },
        ] as unknown as GetTaxesGroupResponse['taxAssociations'],
      }),
    ).toBe('VAT, Cess');
  });
});
