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

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import en from '../../../assets/i18n/en.json';
import { StandingInstructionHistoryComponent } from './standing-instruction-history.component';

describe('StandingInstructionHistoryComponent', () => {
  it('labels the error log column "Error Log" rather than the failure message', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const component = TestBed.runInInjectionContext(
      () => new StandingInstructionHistoryComponent(),
    );

    const errorLog = component.columns.find((column) => column.key === 'errorLog');
    expect(errorLog?.label).toBe('COMMON.ERROR_LOG');
    expect(en.COMMON.ERROR_LOG).toBe('Error Log');
  });
});
