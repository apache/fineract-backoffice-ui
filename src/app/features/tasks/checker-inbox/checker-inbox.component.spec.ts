/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.
 * The ASF licenses this file
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
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MakerCheckerOr4EyeFunctionalityService } from '../../../api';
import { CheckerInboxComponent } from './checker-inbox.component';

describe('CheckerInboxComponent', () => {
  let component: CheckerInboxComponent;
  let fixture: ComponentFixture<CheckerInboxComponent>;

  let makerCheckerService: jasmine.SpyObj<MakerCheckerOr4EyeFunctionalityService>;

  beforeEach(async () => {
    makerCheckerService = jasmine.createSpyObj('MakerCheckerOr4EyeFunctionalityService', [
      'approveMakerCheckerEntry',
      'deleteMakerCheckerEntry',
    ]);

    makerCheckerService.approveMakerCheckerEntry.and.returnValue(
      of({}) as unknown as ReturnType<
        MakerCheckerOr4EyeFunctionalityService['approveMakerCheckerEntry']
      >,
    );

    makerCheckerService.deleteMakerCheckerEntry.and.returnValue(
      of({}) as unknown as ReturnType<
        MakerCheckerOr4EyeFunctionalityService['deleteMakerCheckerEntry']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [CheckerInboxComponent],
      providers: [
        {
          provide: MakerCheckerOr4EyeFunctionalityService,
          useValue: makerCheckerService,
        },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            get: (key: string) => of(key),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckerInboxComponent);
    component = fixture.componentInstance;
  });

  it('rejects a maker-checker task without deleting audit entry', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.onReject({ id: 42 });

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to reject this task?');

    expect(makerCheckerService.approveMakerCheckerEntry).toHaveBeenCalledWith(42, 'reject');

    expect(makerCheckerService.deleteMakerCheckerEntry).not.toHaveBeenCalled();
  });
});
