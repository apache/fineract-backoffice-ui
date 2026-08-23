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
import { StaffListComponent } from './staff-list.component';
import { StaffService, StaffData } from '../../../api';
import { of, throwError, Observable } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('StaffListComponent', () => {
  let component: StaffListComponent;
  let fixture: ComponentFixture<StaffListComponent>;
  let staffServiceSpy: SpyObj<StaffService>;

  beforeEach(async () => {
    staffServiceSpy = createSpyObj(['getStaff']);
    staffServiceSpy.getStaff.mockReturnValue(of([]) as unknown as Observable<never>);

    await TestBed.configureTestingModule({
      imports: [StaffListComponent, provideTranslateTesting()],
      providers: [
        { provide: StaffService, useValue: staffServiceSpy },
        { provide: ActivatedRoute, useValue: {} },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load staff', () => {
    const mockStaff = [
      {
        id: 1,
        displayName: 'Staff 1',
        officeName: 'Head Office',
        isLoanOfficer: true,
        isActive: true,
      },
      {
        id: 2,
        displayName: 'Staff 2',
        officeName: 'Branch 1',
        isLoanOfficer: false,
        isActive: false,
      },
    ];
    staffServiceSpy.getStaff.mockReturnValue(of(mockStaff) as unknown as Observable<never>);

    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(staffServiceSpy.getStaff).toHaveBeenCalledWith(undefined, undefined, undefined, 'all');
    expect(component.staff()).toEqual(mockStaff as unknown as StaffData[]);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle error when loading staff', () => {
    staffServiceSpy.getStaff.mockReturnValue(
      throwError(() => new Error('Error loading staff')) as unknown as Observable<never>,
    );
    vi.spyOn(console, 'error');

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Failed to load staff', expect.any(Error));
  });
});
