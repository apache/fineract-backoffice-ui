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
import { LoadErrorComponent } from './load-error.component';
import { provideIonicTesting } from '../../../testing/ionic-testing';

describe('LoadErrorComponent', () => {
  let component: LoadErrorComponent;
  let fixture: ComponentFixture<LoadErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadErrorComponent],
      providers: [provideIonicTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadErrorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('message', 'Could not load the record.');
    fixture.componentRef.setInput('testId', 'thing-load-error');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the message under the given testId', () => {
    const host: HTMLElement = fixture.nativeElement;
    const container = host.querySelector('[data-testid="thing-load-error"]');
    expect(container?.textContent).toContain('Could not load the record.');
  });

  it('renders no action button when actionLabel is empty', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="thing-load-error-action"]')).toBeNull();
  });

  it('emits action when the button is clicked', () => {
    fixture.componentRef.setInput('actionLabel', 'Retry');
    fixture.detectChanges();

    const emitted = vi.fn();
    component.action.subscribe(emitted);

    const host: HTMLElement = fixture.nativeElement;
    const button = host.querySelector<HTMLElement>('[data-testid="thing-load-error-action"]');
    button?.click();

    expect(emitted).toHaveBeenCalledOnce();
  });
});
