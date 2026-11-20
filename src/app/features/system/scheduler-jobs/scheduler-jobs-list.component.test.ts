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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchedulerJobsListComponent } from './scheduler-jobs-list.component';
import { SCHEDULERJOBService, SchedulerService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';
import { signal } from '@angular/core';

describe('SchedulerJobsListComponent', () => {
  let component: SchedulerJobsListComponent;
  let fixture: ComponentFixture<SchedulerJobsListComponent>;
  let jobSpy: SpyObj<SCHEDULERJOBService>;
  let schedulerSpy: SpyObj<SchedulerService>;
  let routerSpy: SpyObj<Router>;
  let dialogSpy: SpyObj<DialogService>;

  beforeEach(async () => {
    jobSpy = createSpyObj(['getJobs', 'postJobsJobId']);
    schedulerSpy = createSpyObj(['getScheduler', 'postScheduler']);
    routerSpy = createSpyObj(['navigate']);
    dialogSpy = createSpyObj<DialogService>(['confirm']);

    jobSpy.getJobs.mockReturnValue(
      of([
        { jobId: 1, displayName: 'Job A', active: true },
        { jobId: 2, displayName: 'Job B', active: true },
      ]) as unknown as ReturnType<SCHEDULERJOBService['getJobs']>,
    );
    jobSpy.postJobsJobId.mockReturnValue(
      of({}) as unknown as ReturnType<SCHEDULERJOBService['postJobsJobId']>,
    );
    schedulerSpy.getScheduler.mockReturnValue(
      of({ active: true }) as unknown as ReturnType<SchedulerService['getScheduler']>,
    );
    schedulerSpy.postScheduler.mockReturnValue(
      of({}) as unknown as ReturnType<SchedulerService['postScheduler']>,
    );
    dialogSpy.confirm.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [SchedulerJobsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: SCHEDULERJOBService, useValue: jobSpy },
        { provide: SchedulerService, useValue: schedulerSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SchedulerJobsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load jobs and scheduler status on init', () => {
    expect(component).toBeTruthy();
    expect(jobSpy.getJobs).toHaveBeenCalled();
    expect(component.jobs()).toHaveLength(2);
    expect(component.schedulerActive()).toBe(true);
  });

  it('should run a job now with executeJob command', () => {
    component.onRunNow({ jobId: 7 });
    expect(jobSpy.postJobsJobId).toHaveBeenCalledWith(7, 'executeJob');
  });

  it('should start the scheduler when toggled on', () => {
    component.onToggleScheduler(true);
    expect(schedulerSpy.postScheduler).toHaveBeenCalledWith('start');
  });

  it('should stop the scheduler when toggled off', () => {
    component.onToggleScheduler(false);
    expect(schedulerSpy.postScheduler).toHaveBeenCalledWith('stop');
  });

  it('should navigate to history', () => {
    component.onHistory({ jobId: 9 });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/scheduler-jobs', 9, 'history']);
  });

  it('should track individual row selection', () => {
    expect(component.isSelected({ jobId: 1 })).toBe(false);

    component.onToggleSelect({ jobId: 1 }, true);
    expect(component.isSelected({ jobId: 1 })).toBe(true);
    expect(component.isSelected({ jobId: 2 })).toBe(false);

    component.onToggleSelect({ jobId: 1 }, false);
    expect(component.isSelected({ jobId: 1 })).toBe(false);
  });

  it('should select and clear all jobs', () => {
    component.onToggleSelectAll(true);
    expect(component.selectedJobIds()).toEqual(new Set([1, 2]));
    expect(component.allSelected()).toBe(true);

    component.onToggleSelectAll(false);
    expect(component.selectedJobIds().size).toBe(0);
    expect(component.allSelected()).toBe(false);
  });

  it('should run every selected job after confirming, then clear selection and reload', async () => {
    component.onToggleSelect({ jobId: 1 }, true);
    component.onToggleSelect({ jobId: 2 }, true);
    jobSpy.getJobs.mockClear();

    await component.onRunSelected();

    expect(dialogSpy.confirm).toHaveBeenCalled();
    expect(jobSpy.postJobsJobId).toHaveBeenCalledWith(1, 'executeJob');
    expect(jobSpy.postJobsJobId).toHaveBeenCalledWith(2, 'executeJob');
    expect(component.selectedJobIds().size).toBe(0);
    expect(jobSpy.getJobs).toHaveBeenCalled();
  });

  it('should not run anything if the confirmation is declined', async () => {
    dialogSpy.confirm.mockResolvedValue(false);
    component.onToggleSelect({ jobId: 1 }, true);

    await component.onRunSelected();

    expect(jobSpy.postJobsJobId).not.toHaveBeenCalled();
    expect(component.selectedJobIds().size).toBe(1);
  });

  it('should do nothing when running with no selection', async () => {
    await component.onRunSelected();
    expect(dialogSpy.confirm).not.toHaveBeenCalled();
  });
});

describe('SchedulerJobsListComponent, Edit action', () => {
  /** Renders the list for a user holding exactly `permissions`, with RBAC on. */
  async function renderFor(permissions: string[]) {
    const jobSpy = createSpyObj<SCHEDULERJOBService>(['getJobs', 'postJobsJobId']);
    jobSpy.getJobs.mockReturnValue(
      of([{ jobId: 1, displayName: 'Job A', active: true }]) as unknown as ReturnType<
        SCHEDULERJOBService['getJobs']
      >,
    );
    const schedulerSpy = createSpyObj<SchedulerService>(['getScheduler', 'postScheduler']);
    schedulerSpy.getScheduler.mockReturnValue(
      of({ active: true }) as unknown as ReturnType<SchedulerService['getScheduler']>,
    );
    const routerSpy = createSpyObj<Router>(['navigate']);

    await TestBed.configureTestingModule({
      imports: [SchedulerJobsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: SCHEDULERJOBService, useValue: jobSpy },
        { provide: SchedulerService, useValue: schedulerSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: createSpyObj<DialogService>(['confirm']) },
        { provide: ConfigService, useValue: { rbacEnabled: signal(true) } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ permissions }),
            hasPermission: (required: string | string[]) =>
              (Array.isArray(required) ? required : [required]).some((code) =>
                permissions.includes(code),
              ),
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SchedulerJobsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, routerSpy };
  }

  it('is offered to a holder of UPDATE_SCHEDULER, and opens the edit route', async () => {
    const { fixture, routerSpy } = await renderFor(['READ_SCHEDULER', 'UPDATE_SCHEDULER']);
    const edit = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="scheduler-job-edit"]',
    );

    expect(edit).not.toBeNull();
    edit!.click();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/scheduler-jobs', 1, 'edit']);
  });

  it('is not offered to an operator who may only run jobs', async () => {
    const { fixture } = await renderFor(['READ_SCHEDULER', 'EXECUTEJOB_SCHEDULER']);

    // The row is there, so the absence below is the gate and not an empty table.
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Job A');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="scheduler-job-edit"]'),
    ).toBeNull();
  });
});
