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
import { By } from '@angular/platform-browser';
import { IonIcon } from '@ionic/angular/standalone';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { IconComponent } from './icon.component';

describe('IconComponent public contract', () => {
  let fixture: ComponentFixture<IconComponent>;
  const icon = (): HTMLElement => fixture.nativeElement.querySelector('ion-icon');
  /** The vendor seam: what this component's app-level inputs actually resolved to. */
  const vendor = (): { color?: string } =>
    fixture.debugElement.query(By.directive(IonIcon)).componentInstance as unknown as {
      color?: string;
    };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
      providers: [provideIonicTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'add-outline');
    fixture.detectChanges();
  });

  it('is decorative by default, so an icon beside its own label is not announced twice', () => {
    expect(icon().getAttribute('name')).toBe('add-outline');
    expect(icon().getAttribute('aria-hidden')).toBe('true');
    expect(icon().hasAttribute('aria-label')).toBe(false);
    expect(vendor().color).toBeUndefined();
  });

  it('maps semantic tones to distinct colours without exposing the vendor palette', () => {
    const colors = new Set<string | undefined>();
    for (const tone of ['success', 'warning', 'danger', 'neutral'] as const) {
      fixture.componentRef.setInput('tone', tone);
      fixture.detectChanges();
      colors.add(vendor().color);
    }
    expect(colors.size).toBe(4);
  });

  it('becomes an announced image once it carries meaning of its own', () => {
    fixture.componentRef.setInput('label', 'Verified');
    fixture.detectChanges();
    expect(icon().getAttribute('aria-label')).toBe('Verified');
    expect(icon().hasAttribute('aria-hidden')).toBe(false);
  });
});
