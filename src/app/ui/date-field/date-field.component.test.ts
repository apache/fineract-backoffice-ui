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

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, NgForm } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { DateFieldComponent } from './date-field.component';

@Component({
  standalone: true,
  imports: [FormsModule, DateFieldComponent],
  template: `
    <form>
      <app-date-field
        label="OFFICES.OPENING_DATE"
        [required]="true"
        pickerId="host-picker"
        [clearable]="clearable()"
        name="openingDate"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
      ></app-date-field>
    </form>
  `,
})
class HostComponent {
  readonly value = signal<string | null>(null);
  readonly clearable = signal(true);
}

describe('DateFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);
  const pick = async (value: string | null) => {
    query('#host-picker').dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('labels the picker button by reference, since a button has no label slot', () => {
    const label = query('.field-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('OFFICES.OPENING_DATE');

    // The focusable control is the button; its accessible name would otherwise be whatever
    // date it happens to show.
    const button = query('ion-datetime-button');
    expect(button.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.id).not.toBe('');
  });

  it('marks a required field', () => {
    expect(query('.required-marker')).not.toBeNull();
  });

  it('shows a placeholder instead of today while there is no value', () => {
    // An unset ion-datetime renders today's date on its button, which reads as a value the
    // operator chose. Three forms hand-rolled this; here it is the default.
    expect(query('[slot="date-target"]')?.textContent).toContain('COMMON.NOT_SET');
  });

  it('writes the picked day back through ngModel', async () => {
    await pick('2026-06-15');

    expect(host.value()).toBe('2026-06-15');
    expect(query('[slot="date-target"]')).toBeNull();
  });

  it('takes the first day when the picker answers an array', async () => {
    // `ion-datetime` answers an array for its multi-date presentations; this field is one day.
    query('#host-picker').dispatchEvent(
      new CustomEvent('ionChange', { detail: { value: ['2026-07-01', '2026-07-02'] } }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.value()).toBe('2026-07-01');
  });

  it('clears back to no value, and says so on the button again', async () => {
    await pick('2026-06-15');
    expect(query('[data-testid="clear-host-picker"]')).not.toBeNull();

    query('[data-testid="clear-host-picker"]').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.value()).toBeNull();
    expect(query('[slot="date-target"]')?.textContent).toContain('COMMON.NOT_SET');
  });

  it('offers no clear action when the caller did not ask for one', async () => {
    host.clearable.set(false);
    await pick('2026-06-15');

    expect(query('[data-testid="clear-host-picker"]')).toBeNull();
  });

  it('registers in the form under its name, so required still counts', () => {
    const form = fixture.debugElement.query(By.css('form')).injector.get<NgForm>(NgForm);

    // A wrapper that swallowed the name would silently drop this field from form validity.
    expect(form.controls['openingDate']).toBeDefined();
    expect(form.controls['openingDate'].invalid).toBe(true);
  });
});
