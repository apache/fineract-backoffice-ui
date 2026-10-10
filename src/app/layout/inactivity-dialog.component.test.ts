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

import { createSpyObj, SpyObj } from '../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InactivityDialogComponent } from './inactivity-dialog.component';
import { ModalController } from '@ionic/angular/standalone';
import { provideIonicTesting } from '../testing/ionic-testing';
import { provideTranslateTesting } from '../testing/i18n-testing';

describe('InactivityDialogComponent', () => {
  let component: InactivityDialogComponent;
  let fixture: ComponentFixture<InactivityDialogComponent>;
  let mockModalController: SpyObj<ModalController>;

  beforeEach(async () => {
    mockModalController = createSpyObj<ModalController>(['dismiss']);

    await TestBed.configureTestingModule({
      imports: [InactivityDialogComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: ModalController, useValue: mockModalController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InactivityDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dismiss with true on extend', () => {
    component.onExtend();
    expect(mockModalController.dismiss).toHaveBeenCalledWith(true);
  });

  it('should dismiss with false on logout', () => {
    component.onLogout();
    expect(mockModalController.dismiss).toHaveBeenCalledWith(false);
  });
});
