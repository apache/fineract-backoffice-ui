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
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { SCHEDULERJOBService } from '../../../api';
import { FineractSchedulerJobApi, mapSchedulerJob } from './fineract-scheduler-job.api';

/** Shaped after Fineract's `JobDetailData`, which is what `GET /jobs/{id}` serialises. */
const INTEREST_POSTING = {
  jobId: 7,
  displayName: 'Post Interest For Savings',
  shortName: 'SA_POST',
  nextRunTime: '2026-10-27T00:00:00.000+00:00',
  cronExpression: '0 0 0 1/1 * ? *',
  active: true,
  currentlyRunning: false,
};

describe('mapSchedulerJob', () => {
  it('maps a whole job', () => {
    expect(mapSchedulerJob(INTEREST_POSTING)).toEqual({
      id: 7,
      displayName: 'Post Interest For Savings',
      cronExpression: '0 0 0 1/1 * ? *',
      active: true,
      currentlyRunning: false,
    });
  });

  it('refuses a job with no id rather than saving to the wrong one', () => {
    expect(() => mapSchedulerJob({ ...INTEREST_POSTING, jobId: undefined })).toThrow(/no jobId/);
  });
});

describe('FineractSchedulerJobApi', () => {
  let service: { getJobsJobId: ReturnType<typeof vi.fn>; putJobsJobId: ReturnType<typeof vi.fn> };
  let api: FineractSchedulerJobApi;

  beforeEach(() => {
    service = { getJobsJobId: vi.fn(), putJobsJobId: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: SCHEDULERJOBService, useValue: service }],
    });
    api = TestBed.inject(FineractSchedulerJobApi);
  });

  it('sends every field the platform accepts, with the expression trimmed', async () => {
    service.putJobsJobId.mockReturnValue(of({ resourceId: 7, changes: { active: false } }));

    const outcome = await firstValueFrom(
      api.update(7, {
        displayName: 'Post Interest',
        cronExpression: ' 0 0 1 * * ? ',
        active: false,
      }),
    );

    expect(service.putJobsJobId).toHaveBeenCalledWith(7, {
      displayName: 'Post Interest',
      cronExpression: '0 0 1 * * ?',
      active: false,
    });
    expect(outcome).toEqual({ pendingApproval: false });
  });

  it('sends only the fields it is given', async () => {
    service.putJobsJobId.mockReturnValue(of({ resourceId: 7, changes: { active: false } }));

    await firstValueFrom(api.update(7, { active: false }));

    expect(service.putJobsJobId).toHaveBeenCalledWith(7, { active: false });
  });

  it('reports a change maker-checker queued instead of applying', async () => {
    service.putJobsJobId.mockReturnValue(of({ commandId: 31 }));

    const outcome = await firstValueFrom(
      api.update(7, { displayName: 'Post Interest', cronExpression: '0 0 1 * * ?', active: true }),
    );

    expect(outcome).toEqual({ pendingApproval: true });
  });
});
