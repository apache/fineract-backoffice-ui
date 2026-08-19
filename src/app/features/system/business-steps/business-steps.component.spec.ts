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
import { BusinessStepsComponent } from './business-steps.component';
import { BusinessStepConfigurationService } from '../../../api';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('BusinessStepsComponent', () => {
  let component: BusinessStepsComponent;
  let fixture: ComponentFixture<BusinessStepsComponent>;
  let serviceSpy: jasmine.SpyObj<BusinessStepConfigurationService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('BusinessStepConfigurationService', [
      'getJobsNames',
      'getJobsJobNameSteps',
      'putJobsJobNameSteps',
    ]);
    serviceSpy.getJobsNames.and.returnValue(
      of({ businessJobs: ['LOAN_CLOSE_OF_BUSINESS'] }) as unknown as ReturnType<
        BusinessStepConfigurationService['getJobsNames']
      >,
    );
    serviceSpy.getJobsJobNameSteps.and.returnValue(
      of({
        jobName: 'LOAN_CLOSE_OF_BUSINESS',
        businessSteps: [
          { stepName: 'b', order: 2 },
          { stepName: 'a', order: 1 },
        ],
      }) as unknown as ReturnType<BusinessStepConfigurationService['getJobsJobNameSteps']>,
    );

    await TestBed.configureTestingModule({
      imports: [BusinessStepsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: BusinessStepConfigurationService, useValue: serviceSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessStepsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load job names on init', () => {
    expect(component.jobNames()).toHaveSize(1);
  });

  it('should load and sort steps by order', () => {
    component.selectedJob = 'LOAN_CLOSE_OF_BUSINESS';
    component.loadSteps();
    expect(component.steps()[0].stepName).toBe('a');
  });

  it('should save reordered steps', () => {
    serviceSpy.putJobsJobNameSteps.and.returnValue(
      of({}) as unknown as ReturnType<BusinessStepConfigurationService['putJobsJobNameSteps']>,
    );
    component.selectedJob = 'LOAN_CLOSE_OF_BUSINESS';
    component.loadSteps();
    component.moveDown(0);
    component.onSave();
    expect(serviceSpy.putJobsJobNameSteps).toHaveBeenCalled();
  });

  it('gives the reorder buttons an accessible name', () => {
    component.selectedJob = 'LOAN_CLOSE_OF_BUSINESS';
    component.loadSteps();
    fixture.detectChanges();

    // The buttons are icon-only, so the icon is all a sighted user gets and an
    // accessible name is all a screen reader gets. Without one, a row of these
    // announces as "button, button".
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('ion-button') as NodeListOf<HTMLElement>,
    ).map((button) => button.getAttribute('aria-label'));

    expect(labels).toContain('COMMON.MOVE_UP');
    expect(labels).toContain('COMMON.MOVE_DOWN');
  });
});
