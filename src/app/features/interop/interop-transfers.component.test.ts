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
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NotificationService } from '../../core/services/notification.service';
import { createSpyObj } from '../../testing/mocks';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { expectLookedUp } from '../../testing/translated-text';
import { InteropTransfersComponent } from './interop-transfers.component';

describe('InteropTransfersComponent', () => {
  let fixture: ComponentFixture<InteropTransfersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteropTransfersComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: NotificationService,
          useValue: createSpyObj<NotificationService>(['success', 'error', 'show']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InteropTransfersComponent);
    fixture.detectChanges();
  });

  it('renders the disburse and repay tab through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, ['INTEROP.DISBURSE_REPAY']);
  });
});
