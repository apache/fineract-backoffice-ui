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
import { FormsModule } from '@angular/forms';
import { IonInput } from '@ionic/angular/standalone';

import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { FormFieldComponent } from './form-field.component';

@Component({
  standalone: true,
  imports: [FormsModule, FormFieldComponent, IonInput],
  template: `
    <form #hostForm="ngForm">
      <app-form-field
        label="OFFICES.NAME"
        [required]="required()"
        [showError]="showError()"
        errorTestId="host-field-error"
      >
        <ion-input
          name="officeName"
          [(ngModel)]="value"
          #model="ngModel"
          (ionBlur)="model.control.markAsTouched()"
          required
          data-testid="host-input"
        ></ion-input>
      </app-form-field>
    </form>
  `,
})
class HostComponent {
  readonly required = signal(true);
  readonly showError = signal(false);
  value = '';
}

describe('FormFieldComponent', () => {
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

  it('renders the label from its translation key', () => {
    expect(fixture.nativeElement.textContent).toContain('OFFICES.NAME');
  });

  it('marks a required field', () => {
    expect(query('.required-marker')).not.toBeNull();

    host.required.set(false);
    fixture.detectChanges();

    expect(query('.required-marker')).toBeNull();
  });

  it('puts the label in the control label slot, so the control is what it names', () => {
    const input = query('[data-testid="host-input"]');
    const label = input.querySelector('[slot="label"]');

    // Not a sibling: Ionic 8 reads the control's own label property or its label slot, and
    // nothing else. A sibling ion-label names nothing, which is the defect behind #287.
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('OFFICES.NAME');
    expect(input.labelPlacement).toBe('stacked');
  });

  it('leaves the projected control registered under its own name', () => {
    // Template-driven validity is registered by `name`; a wrapper that swallowed it would
    // silently disable every submit button bound to form.invalid.
    const input = query('[data-testid="host-input"]');
    expect(input.getAttribute('name')).toBe('officeName');
  });

  it('shows the error the caller asks for, with the role that announces it', () => {
    // The wrapper's contract is "show it when told to". That the caller's condition tracks its
    // control's invalid/touched state is the converted form's business, and its own spec — which
    // this change left untouched — covers that end of it.
    expect(query('[data-testid="host-field-error"]')).toBeNull();

    host.showError.set(true);
    fixture.detectChanges();

    const error = query('[data-testid="host-field-error"]');
    expect(error).not.toBeNull();
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('COMMON.REQUIRED');
  });

  it('hides the error again when the caller stops asking', () => {
    host.showError.set(true);
    fixture.detectChanges();
    expect(query('[data-testid="host-field-error"]')).not.toBeNull();

    host.showError.set(false);
    fixture.detectChanges();

    expect(query('[data-testid="host-field-error"]')).toBeNull();
  });
});
