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
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SCHEDULER_JOB_API, type SchedulerJob } from '../../../core/adapters';
import { NotificationService } from '../../../core/services/notification.service';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { SchedulerJobFormComponent } from './scheduler-job-form.component';

const JOB: SchedulerJob = {
  id: 7,
  displayName: 'Post Interest For Savings',
  cronExpression: '0 0 0 1/1 * ? *',
  active: true,
  currentlyRunning: false,
};

describe('SchedulerJobFormComponent', () => {
  let fixture: ComponentFixture<SchedulerJobFormComponent>;
  let component: SchedulerJobFormComponent;
  let jobApi: SpyObj<{ get: (id: number) => unknown; update: (id: number, c: unknown) => unknown }>;
  let router: SpyObj<Router>;
  let notifications: SpyObj<NotificationService>;

  async function create(
    job: SchedulerJob | Error | HttpErrorResponse = JOB,
    id = '7',
  ): Promise<void> {
    jobApi = createSpyObj(['get', 'update']);
    jobApi.get.mockReturnValue(
      job instanceof Error || job instanceof HttpErrorResponse ? throwError(() => job) : of(job),
    );
    jobApi.update.mockReturnValue(of({ pendingApproval: false }));
    router = createSpyObj(['navigate']);
    notifications = createSpyObj(['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [SchedulerJobFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: SCHEDULER_JOB_API, useValue: jobApi },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SchedulerJobFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const element = () => fixture.nativeElement as HTMLElement;

  it('loads the job into the form', async () => {
    await create();

    expect(jobApi.get).toHaveBeenCalledWith(7);
    expect(component.displayName()).toBe('Post Interest For Savings');
    expect(component.cronExpression()).toBe('0 0 0 1/1 * ? *');
    expect(component.active()).toBe(true);
  });

  it('previews the next three runs of a valid expression', async () => {
    await create();

    expect(component.nextRuns()).toHaveLength(3);
    expect(element().querySelectorAll('[data-testid="scheduler-job-next-runs"] li')).toHaveLength(
      3,
    );
  });

  it('sends the edited name, expression and active flag, then returns to the list', async () => {
    await create();
    component.displayName.set('  Post Interest  ');
    component.cronExpression.set('0 30 1 * * ?');
    component.active.set(false);

    component.onSubmit();

    expect(jobApi.update).toHaveBeenCalledWith(7, {
      displayName: 'Post Interest',
      cronExpression: '0 30 1 * * ?',
      active: false,
    });
    expect(notifications.success).toHaveBeenCalledWith('SCHEDULER_JOBS.SAVED');
    expect(router.navigate).toHaveBeenCalledWith(['/system/scheduler-jobs']);
  });

  it('says so when maker-checker queues the change', async () => {
    await create();
    jobApi.update.mockReturnValue(of({ pendingApproval: true }));
    component.active.set(false);

    component.onSubmit();

    expect(notifications.success).toHaveBeenCalledWith('SCHEDULER_JOBS.SUBMITTED_FOR_APPROVAL');
  });

  it.each([
    ['0 0 * * * *', 'SCHEDULER_JOBS.CRON_DAY_CONFLICT'],
    ['0 0 12 * *', 'SCHEDULER_JOBS.CRON_FIELD_COUNT'],
    ['0 0 25 * * ?', 'SCHEDULER_JOBS.CRON_INVALID_FIELD'],
    ['0 0 0 30 2 ?', 'SCHEDULER_JOBS.CRON_NEVER_FIRES'],
  ])('catches %s before submit', async (expression, message) => {
    await create();
    component.cronExpression.set(expression);
    fixture.detectChanges();

    expect(component.cronError()).toBe(message);
    expect(element().querySelector('[data-testid="scheduler-job-cron-error"]')?.textContent).toBe(
      message,
    );
    expect(element().querySelector('#cronExpression')?.getAttribute('aria-invalid')).toBe('true');
    expect(component.canSave()).toBe(false);

    component.onSubmit();
    expect(jobApi.update).not.toHaveBeenCalled();
  });

  it('will not save a blank name', async () => {
    await create();
    component.displayName.set(' '.repeat(3));

    expect(component.canSave()).toBe(false);
  });

  it('shows a running job read-only', async () => {
    await create({ ...JOB, currentlyRunning: true });

    expect(element().querySelector('[data-testid="scheduler-job-running"]')).not.toBeNull();
    expect(element().querySelector('fieldset')?.disabled).toBe(true);
    expect(component.canSave()).toBe(false);
  });

  it('reports a failed load with a retry, not an empty form', async () => {
    await create(new Error('offline'));

    expect(element().querySelector('[data-testid="scheduler-job-load-error"]')).not.toBeNull();
    expect(element().querySelector('form')).toBeNull();

    jobApi.get.mockReturnValue(of(JOB));
    component.load();
    fixture.detectChanges();

    expect(element().querySelector('form')).not.toBeNull();
  });

  it('reports a malformed id as a failed load instead of an empty form', async () => {
    await create(JOB, 'abc');

    expect(jobApi.get).not.toHaveBeenCalled();
    expect(element().querySelector('[data-testid="scheduler-job-load-error"]')).not.toBeNull();
    // Retrying cannot load a malformed id, so the action leaves instead.
    element()
      .querySelector<HTMLElement>('[data-testid="scheduler-job-load-error-action"]')!
      .click();
    expect(router.navigate).toHaveBeenCalledWith(['/system/scheduler-jobs']);
    expect(element().querySelector('form')).toBeNull();
  });

  it('offers a way back, not a retry, when the job does not exist', async () => {
    await create(new HttpErrorResponse({ status: 404 }));

    expect(component.canRetry()).toBe(false);
    element()
      .querySelector<HTMLElement>('[data-testid="scheduler-job-load-error-action"]')!
      .click();
    expect(router.navigate).toHaveBeenCalledWith(['/system/scheduler-jobs']);
    expect(jobApi.get).toHaveBeenCalledTimes(1);
  });

  it('lets a job whose stored cron it refuses be deactivated, sending only that change', async () => {
    await create({ ...JOB, cronExpression: '0 0 0 1 1 ? 2020' });
    expect(component.cronCheck().state).toBe('invalid');
    expect(component.canSave()).toBe(false);

    component.active.set(false);
    expect(component.canSave()).toBe(true);
    component.onSubmit();

    expect(jobApi.update).toHaveBeenCalledWith(7, { active: false });
  });

  it('has nothing to save until something changes', async () => {
    await create();

    expect(component.changes()).toEqual({});
    expect(component.canSave()).toBe(false);
  });

  it('refuses to save when the job started running after the form opened', async () => {
    await create();
    component.active.set(false);
    jobApi.get.mockReturnValue(of({ ...JOB, currentlyRunning: true }));

    component.onSubmit();

    expect(jobApi.update).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('SCHEDULER_JOBS.STARTED_RUNNING');
    expect(component.currentlyRunning()).toBe(true);
    expect(component.isSaving()).toBe(false);
  });

  it('stays on the form with Save available again when the platform refuses the change', async () => {
    await create();
    component.active.set(false);
    jobApi.update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

    component.onSubmit();

    expect(component.isSaving()).toBe(false);
    expect(component.canSave()).toBe(true);
    expect(notifications.success).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('offers a way back, not a retry, when the read is refused', async () => {
    await create(new HttpErrorResponse({ status: 403 }));

    expect(component.canRetry()).toBe(false);
  });

  it('labels the preview with the tenant time zone', async () => {
    await create();
    fixture.detectChanges();

    expect(component.nextRunsLabel()).toContain('SCHEDULER_JOBS.NEXT_RUNS_IN_ZONE');
  });
});
