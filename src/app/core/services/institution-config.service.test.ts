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

import { TestBed } from '@angular/core/testing';
import { FakeStorageAdapter, provideFakeAdapters } from '../../testing/adapters';
import { InstitutionConfigService, InstitutionType } from './institution-config.service';

describe('InstitutionConfigService', () => {
  let service: InstitutionConfigService;
  let storage: FakeStorageAdapter;
  let adapterProviders: ReturnType<typeof provideFakeAdapters>['providers'];

  const createService = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [InstitutionConfigService, ...adapterProviders],
    });
    service = TestBed.inject(InstitutionConfigService);
  };

  beforeEach(() => {
    const fakes = provideFakeAdapters();
    storage = fakes.storage;
    adapterProviders = fakes.providers;
  });

  it('should be created', () => {
    createService();
    expect(service).toBeTruthy();
  });

  it('should default to "universal" when nothing is stored', () => {
    createService();
    expect(service.institutionType()).toBe('universal');
    expect(service.isFeatureEnabled('groups')).toBe(true);
    expect(service.isFeatureEnabled('centers')).toBe(true);
    expect(service.isFeatureEnabled('collection_sheet')).toBe(true);
  });

  it('should read a valid persisted institution type on init', () => {
    storage.writeRaw('institutionType', 'cb');
    createService();
    expect(service.institutionType()).toBe('cb');
  });

  it('should fall back to "universal" when the stored value is invalid', () => {
    storage.writeRaw('institutionType', 'not-a-real-type');
    createService();
    expect(service.institutionType()).toBe('universal');
  });

  it('should persist the institution type and update the signal on set', () => {
    createService();
    service.setInstitutionType('mfis');
    expect(service.institutionType()).toBe('mfis');
    expect(storage.readRaw('institutionType')).toBe('mfis');
  });

  describe('isFeatureEnabled matrix', () => {
    const cases: {
      type: InstitutionType;
      groups: boolean;
      centers: boolean;
      collection_sheet: boolean;
    }[] = [
      { type: 'mfis', groups: true, centers: true, collection_sheet: true },
      { type: 'cb', groups: false, centers: false, collection_sheet: false },
      { type: 'cu', groups: true, centers: false, collection_sheet: false },
      { type: 'universal', groups: true, centers: true, collection_sheet: true },
    ];

    cases.forEach(({ type, groups, centers, collection_sheet }) => {
      it(`should resolve features correctly for "${type}"`, () => {
        createService();
        service.setInstitutionType(type);
        expect(service.isFeatureEnabled('groups')).toBe(groups);
        expect(service.isFeatureEnabled('centers')).toBe(centers);
        expect(service.isFeatureEnabled('collection_sheet')).toBe(collection_sheet);
      });
    });
  });
});
