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

import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { CardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card [heading]="heading()">
      <p data-testid="projected">Body</p>
    </app-card>
  `,
})
class HostComponent {
  readonly heading = signal('WC_PORTFOLIO.BY_STATUS');
}

describe('CardComponent', () => {
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
  });

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  it('renders its heading from a translation key', () => {
    expect(query('ion-card-title').textContent).toContain('WC_PORTFOLIO.BY_STATUS');
  });

  it('omits the header entirely when untitled', () => {
    host.heading.set('');
    fixture.detectChanges();

    // An empty header would still take vertical space and read as a blank title.
    expect(query('ion-card-header')).toBeNull();
    expect(query('ion-card')).not.toBeNull();
  });

  it('projects its content', () => {
    expect(query('[data-testid="projected"]')).not.toBeNull();
    expect(query('ion-card-content').textContent).toContain('Body');
  });

  it('takes its heading as `heading`, leaving the host title attribute alone', () => {
    // A `title` input would also land on the host as the HTML title attribute, which browsers
    // render as a hover tooltip over the whole card.
    expect(query('app-card').hasAttribute('title')).toBe(false);
  });
});
