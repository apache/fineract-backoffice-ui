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

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HasInstitutionFeatureDirective } from './has-institution-feature.directive';
import { InstitutionConfigService } from '../../core/services/institution-config.service';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTestConfig } from '../../testing/config';

@Component({
  template: `
    <div id="groups" *appInstitutionFeature="'groups'">Groups</div>
    <div id="centers" *appInstitutionFeature="'centers'">Centers</div>
    <div id="collection-sheet" *appInstitutionFeature="'collection_sheet'">Collection Sheet</div>
  `,
  standalone: true,
  imports: [HasInstitutionFeatureDirective],
})
class TestComponent {}

const GROUPS_SELECTOR = '#groups';
const CENTERS_SELECTOR = '#centers';
const COLLECTION_SHEET_SELECTOR = '#collection-sheet';

describe('HasInstitutionFeatureDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let service: InstitutionConfigService;

  const render = () => {
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
  };

  /** Configures the TestBed with RBAC on or off for this deployment. */
  function configure(rbacEnabled: boolean): void {
    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [
        InstitutionConfigService,
        provideTestConfig({ rbacEnabled }),
        ...provideFakeAdapters().providers,
      ],
    });
    service = TestBed.inject(InstitutionConfigService);
  }

  beforeEach(() => {
    configure(true);
  });

  it('should render all feature items for "universal"', () => {
    service.setInstitutionType('universal');
    render();
    expect(fixture.debugElement.query(By.css(GROUPS_SELECTOR))).toBeTruthy();
    expect(fixture.debugElement.query(By.css(CENTERS_SELECTOR))).toBeTruthy();
    expect(fixture.debugElement.query(By.css(COLLECTION_SHEET_SELECTOR))).toBeTruthy();
  });

  it('should hide all feature items for "cb"', () => {
    service.setInstitutionType('cb');
    render();
    expect(fixture.debugElement.query(By.css(GROUPS_SELECTOR))).toBeNull();
    expect(fixture.debugElement.query(By.css(CENTERS_SELECTOR))).toBeNull();
    expect(fixture.debugElement.query(By.css(COLLECTION_SHEET_SELECTOR))).toBeNull();
  });

  it('should render only enabled features for "cu"', () => {
    service.setInstitutionType('cu');
    render();
    expect(fixture.debugElement.query(By.css(GROUPS_SELECTOR))).toBeTruthy();
    expect(fixture.debugElement.query(By.css(CENTERS_SELECTOR))).toBeNull();
    expect(fixture.debugElement.query(By.css(COLLECTION_SHEET_SELECTOR))).toBeNull();
  });

  it('should render everything when RBAC is disabled, regardless of institution type', () => {
    TestBed.resetTestingModule();
    configure(false);
    service.setInstitutionType('cb');
    render();
    expect(fixture.debugElement.query(By.css(GROUPS_SELECTOR))).toBeTruthy();
    expect(fixture.debugElement.query(By.css(CENTERS_SELECTOR))).toBeTruthy();
    expect(fixture.debugElement.query(By.css(COLLECTION_SHEET_SELECTOR))).toBeTruthy();
  });
});
