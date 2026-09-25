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
import { DeferredDatetimeButtonComponent } from './deferred-datetime-button.component';
import { provideIonicTesting } from '../../testing/ionic-testing';

const FIRST_PICKER_ID = 'periodfromDate-picker-0';
const SECOND_PICKER_ID = 'periodfromDate-picker-1';

describe('DeferredDatetimeButtonComponent', () => {
  let fixture: ComponentFixture<DeferredDatetimeButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeferredDatetimeButtonComponent],
      providers: [provideIonicTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DeferredDatetimeButtonComponent);
    fixture.componentRef.setInput('datetimeId', FIRST_PICKER_ID);
  });

  it('does not create the button on the first render', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ion-datetime-button')).toBeNull();
  });

  it('creates the button after the next render and stamps a real datetime attribute', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('ion-datetime-button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('datetime')).toBe(FIRST_PICKER_ID);
  });

  it("does not reuse another instance's datetime id", async () => {
    const second = TestBed.createComponent(DeferredDatetimeButtonComponent);
    second.componentRef.setInput('datetimeId', SECOND_PICKER_ID);

    fixture.detectChanges();
    second.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    second.detectChanges();
    await fixture.whenStable();

    const firstButton = fixture.nativeElement.querySelector('ion-datetime-button');
    const secondButton = second.nativeElement.querySelector('ion-datetime-button');
    expect(firstButton.getAttribute('datetime')).toBe(FIRST_PICKER_ID);
    expect(secondButton.getAttribute('datetime')).toBe(SECOND_PICKER_ID);
    expect(firstButton.getAttribute('datetime')).not.toBe(secondButton.getAttribute('datetime'));
  });
});
