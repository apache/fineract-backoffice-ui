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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

import { InteropHealthComponent } from './interop-health.component';
import { InterOperationService } from '../../api';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';

const SPINNER_SELECTOR = 'ion-spinner';

describe('InteropHealthComponent', () => {
  let fixture: ComponentFixture<InteropHealthComponent>;
  let component: InteropHealthComponent;
  let interopService: jasmine.SpyObj<InterOperationService>;
  let healthResponse: Subject<unknown>;

  beforeEach(async () => {
    healthResponse = new Subject<unknown>();
    interopService = jasmine.createSpyObj('InterOperationService', ['getInteroperationHealth']);
    interopService.getInteroperationHealth.and.returnValue(healthResponse as never);

    await TestBed.configureTestingModule({
      imports: [InteropHealthComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: InterOperationService, useValue: interopService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InteropHealthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function checkHealth(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector('ion-button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    return button;
  }

  it('requests health and exposes the pending state', () => {
    const button = checkHealth();

    expect(interopService.getInteroperationHealth).toHaveBeenCalledOnceWith();
    expect(component.isLoading()).toBeTrue();
    expect(button.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector(SPINNER_SELECTOR)).not.toBeNull();
  });

  it('renders the health response returned by the platform', () => {
    const button = checkHealth();

    healthResponse.next({ status: 'UP', version: '1.2.3' });
    healthResponse.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('pre')?.textContent).toContain('"status": "UP"');
    expect(component.isLoading()).toBeFalse();
    expect(button.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector(SPINNER_SELECTOR)).toBeNull();
  });

  it('re-enables the health check after a failed request', () => {
    const button = checkHealth();

    healthResponse.error(new Error('unavailable'));
    fixture.detectChanges();

    expect(component.health()).toBeNull();
    expect(component.isLoading()).toBeFalse();
    expect(button.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector(SPINNER_SELECTOR)).toBeNull();
  });
});
