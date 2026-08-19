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
import { HelpIconComponent } from './help-icon.component';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideIonicTesting } from '../../../testing/ionic-testing';

const HELP_KEY = 'TEST.HELP_KEY';

describe('HelpIconComponent', () => {
  let component: HelpIconComponent;
  let fixture: ComponentFixture<HelpIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpIconComponent],
      providers: [provideIonicTesting(), ...provideFakeAdapters().providers],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpIconComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('helpTextKey', HELP_KEY);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have helpTextKey as input', () => {
    expect(component.helpTextKey()).toBe(HELP_KEY);
  });

  it('renders the ionicon help glyph', () => {
    const icon = fixture.nativeElement.querySelector('ion-icon');

    expect(icon).toBeTruthy();
    expect(icon.getAttribute('name')).toBe('help-circle-outline');
  });

  it('exposes the help text to assistive technology', () => {
    // The hover text is rendered by TooltipDirective; aria-label carries the same
    // string for screen readers, which never see the tooltip element.
    const icon = fixture.nativeElement.querySelector('ion-icon');

    expect(icon.getAttribute('aria-label')).toBe(HELP_KEY);
  });
});
