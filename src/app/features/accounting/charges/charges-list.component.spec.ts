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

import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ChargesListComponent } from './charges-list.component';
import { ChargesService } from '../../../api';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ChargesListComponent', () => {
  let component: ChargesListComponent;
  let fixture: ComponentFixture<ChargesListComponent>;
  let serviceSpy: jasmine.SpyObj<ChargesService>;

  const charges = [{ id: 1, name: 'Processing fee', amount: 10 }];

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('ChargesService', ['getCharges']);
    serviceSpy.getCharges.and.returnValue(
      of(charges) as unknown as ReturnType<ChargesService['getCharges']>,
    );

    await TestBed.configureTestingModule({
      imports: [ChargesListComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: ChargesService, useValue: serviceSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChargesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads charges on init', () => {
    expect(serviceSpy.getCharges).toHaveBeenCalledTimes(1);
    expect(component.charges()).toEqual(charges);
    expect(component.hasError()).toBeFalse();
  });

  it('shows a load error instead of an empty table', () => {
    serviceSpy.getCharges.and.returnValue(
      throwError(() => new Error('boom')) as unknown as ReturnType<ChargesService['getCharges']>,
    );

    component.onRetry();
    fixture.detectChanges();

    expect(component.hasError()).toBeTrue();
    expect(component.charges()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="data-table-error"]')).not.toBeNull();
  });

  it('clears the error after a successful retry', () => {
    serviceSpy.getCharges.and.returnValue(
      throwError(() => new Error('boom')) as unknown as ReturnType<ChargesService['getCharges']>,
    );
    component.onRetry();
    expect(component.hasError()).toBeTrue();

    serviceSpy.getCharges.and.returnValue(
      of(charges) as unknown as ReturnType<ChargesService['getCharges']>,
    );

    component.onRetry();

    expect(component.hasError()).toBeFalse();
    expect(component.charges()).toEqual(charges);
  });
});
