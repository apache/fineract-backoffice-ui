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
import { InlineJobComponent, InlineJobService } from './inline-job.component';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

describe('InlineJobComponent', () => {
  let component: InlineJobComponent;
  let fixture: ComponentFixture<InlineJobComponent>;
  let inlineJobServiceSpy: SpyObj<InlineJobService>;

  beforeEach(async () => {
    inlineJobServiceSpy = createSpyObj(['postJobsJobNameInline']);

    await TestBed.configureTestingModule({
      imports: [InlineJobComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: InlineJobService, useValue: inlineJobServiceSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InlineJobComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component with initial state', () => {
    expect(component).toBeTruthy();
    expect(component.jobName).toBe('');
    expect(component.jobBody).toBe('');
    expect(component.isRunning()).toBe(false);
    expect(component.result()).toBeNull();
    expect(component.error()).toBeNull();
  });

  it('sets error when jobBody is invalid JSON', () => {
    component.jobName = 'testJob';
    component.jobBody = '{ invalid json }';

    component.runJob();

    expect(component.error()).toBeTruthy();
    expect(component.isRunning()).toBe(false);
    expect(inlineJobServiceSpy.postJobsJobNameInline).not.toHaveBeenCalled();
  });

  it('executes job successfully with valid JSON body', () => {
    const mockResponse = { resourceId: 101 };
    inlineJobServiceSpy.postJobsJobNameInline.mockReturnValue(
      of(mockResponse) as unknown as ReturnType<InlineJobService['postJobsJobNameInline']>,
    );

    component.jobName = 'executeJob';
    component.jobBody = '{"param": "val"}';

    component.runJob();

    expect(inlineJobServiceSpy.postJobsJobNameInline).toHaveBeenCalledWith('executeJob', {
      param: 'val',
    });
    expect(component.isRunning()).toBe(false);
    expect(component.result()).toEqual(mockResponse);
    expect(component.error()).toBeNull();
  });

  it('executes job without body when jobBody is empty', () => {
    const mockResponse = { resourceId: 102 };
    inlineJobServiceSpy.postJobsJobNameInline.mockReturnValue(
      of(mockResponse) as unknown as ReturnType<InlineJobService['postJobsJobNameInline']>,
    );

    component.jobName = 'loanJob';
    component.jobBody = ' '.repeat(3);

    component.runJob();

    expect(inlineJobServiceSpy.postJobsJobNameInline).toHaveBeenCalledWith('loanJob', undefined);
    expect(component.isRunning()).toBe(false);
    expect(component.result()).toEqual(mockResponse);
  });

  it('handles server failure and records error', () => {
    inlineJobServiceSpy.postJobsJobNameInline.mockReturnValue(
      throwError(() => ({ message: 'Job execution failed' })) as unknown as ReturnType<
        InlineJobService['postJobsJobNameInline']
      >,
    );

    component.jobName = 'failJob';
    component.runJob();

    expect(component.isRunning()).toBe(false);
    expect(component.result()).toBeNull();
    expect(component.error()).toBe('Job execution failed');
  });
});
