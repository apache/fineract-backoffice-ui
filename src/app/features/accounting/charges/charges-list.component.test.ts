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
import { DialogService } from '../../../core/services/dialog.service';
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
  let serviceSpy: SpyObj<ChargesService>;

  let dialogSpy: SpyObj<DialogService>;

  const charges = [{ id: 1, name: 'Processing fee', amount: 10 }];

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getCharges', 'deleteChargesChargeId']);
    serviceSpy.deleteChargesChargeId.mockReturnValue(
      of({}) as unknown as ReturnType<ChargesService['deleteChargesChargeId']>,
    );
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    dialogSpy.confirm.mockResolvedValue(true);
    serviceSpy.getCharges.mockReturnValue(
      of(charges) as unknown as ReturnType<ChargesService['getCharges']>,
    );

    await TestBed.configureTestingModule({
      imports: [ChargesListComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: ChargesService, useValue: serviceSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: Router, useValue: createSpyObj(['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChargesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads charges on init', () => {
    expect(serviceSpy.getCharges).toHaveBeenCalledTimes(1);
    expect(component.charges()).toEqual(charges);
    expect(component.hasError()).toBe(false);
  });

  it('shows a load error instead of an empty table', () => {
    serviceSpy.getCharges.mockReturnValue(
      throwError(() => new Error('boom')) as unknown as ReturnType<ChargesService['getCharges']>,
    );

    component.onRetry();
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(component.charges()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="data-table-error"]')).not.toBeNull();
  });

  it('clears the error after a successful retry', () => {
    serviceSpy.getCharges.mockReturnValue(
      throwError(() => new Error('boom')) as unknown as ReturnType<ChargesService['getCharges']>,
    );
    component.onRetry();
    expect(component.hasError()).toBe(true);

    serviceSpy.getCharges.mockReturnValue(
      of(charges) as unknown as ReturnType<ChargesService['getCharges']>,
    );

    component.onRetry();

    expect(component.hasError()).toBe(false);
    expect(component.charges()).toEqual(charges);
  });

  /**
   * Deleting a charge definition (issue #789). An unused or mistyped charge stayed selectable on
   * every product and account form, with no way to remove it.
   */
  it('asks before deleting, then deletes and reloads', async () => {
    const listCallsBefore = serviceSpy.getCharges.mock.calls.length;

    await component.onDeleteCharge(charges[0]);

    const asked = dialogSpy.confirm.mock.lastCall![0];
    expect(asked.destructive).toBe(true);
    expect(asked.details?.[0].value).toBe('Processing fee');
    expect(serviceSpy.deleteChargesChargeId).toHaveBeenCalledWith(1);
    expect(serviceSpy.getCharges.mock.calls.length).toBe(listCallsBefore + 1);
  });

  it('deletes nothing when the confirmation is declined', async () => {
    dialogSpy.confirm.mockResolvedValue(false);

    await component.onDeleteCharge(charges[0]);

    expect(serviceSpy.deleteChargesChargeId).not.toHaveBeenCalled();
  });

  /**
   * A charge attached to a product or account is refused. The platform's reason reaches the user
   * through the error interceptor; what matters here is that the row is not reloaded away as
   * though the delete had worked.
   */
  it('leaves the list alone when the platform refuses the delete', async () => {
    serviceSpy.deleteChargesChargeId.mockReturnValue(
      throwError(() => new Error('charge.is.already.used')) as unknown as ReturnType<
        ChargesService['deleteChargesChargeId']
      >,
    );
    const listCallsBefore = serviceSpy.getCharges.mock.calls.length;

    await component.onDeleteCharge(charges[0]);

    expect(serviceSpy.getCharges.mock.calls.length).toBe(listCallsBefore);
  });
});
