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
import { ReportMailingJobsFormComponent } from './report-mailing-jobs-form.component';
import { ReportMailingJobsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ReportMailingJobsFormComponent', () => {
  let component: ReportMailingJobsFormComponent;
  let fixture: ComponentFixture<ReportMailingJobsFormComponent>;
  let serviceSpy: jasmine.SpyObj<ReportMailingJobsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('ReportMailingJobsService', [
      'getReportmailingjobsEntityId',
      'postReportmailingjobs',
      'putReportmailingjobsEntityId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ReportMailingJobsFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ReportMailingJobsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportMailingJobsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postReportmailingjobs.and.returnValue(
      of({}) as unknown as ReturnType<ReportMailingJobsService['postReportmailingjobs']>,
    );
    component.job.set({
      name: 'New',
      emailRecipients: 'a@b.c',
      emailSubject: 'Sub',
      stretchyReportId: 1,
      isActive: true,
    });
    component.onSubmit();
    expect(serviceSpy.postReportmailingjobs).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/report-mailing-jobs']);
  });
});
