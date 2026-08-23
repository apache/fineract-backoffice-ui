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
import { FundsListComponent } from './funds-list.component';
import { FundsService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('FundsListComponent', () => {
  let component: FundsListComponent;
  let fixture: ComponentFixture<FundsListComponent>;
  let fundsServiceSpy: SpyObj<FundsService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    fundsServiceSpy = createSpyObj(['getFunds']);
    routerSpy = createSpyObj(['navigate']);
    fundsServiceSpy.getFunds.mockReturnValue(
      of([{ id: 1, name: 'Donor Fund', externalId: 'F-1' }]) as unknown as ReturnType<
        FundsService['getFunds']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [FundsListComponent, provideTranslateTesting()],
      providers: [
        { provide: FundsService, useValue: fundsServiceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FundsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load funds on init', () => {
    expect(component).toBeTruthy();
    expect(fundsServiceSpy.getFunds).toHaveBeenCalled();
    expect(component.funds()).toHaveLength(1);
  });

  it('should navigate to create', () => {
    component.onCreate();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/organization/funds/create']);
  });

  it('should navigate to edit with the fund id', () => {
    component.onEdit({ id: 7, name: 'F' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/organization/funds/edit', 7]);
  });
});
