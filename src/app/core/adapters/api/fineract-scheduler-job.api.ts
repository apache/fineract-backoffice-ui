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

import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import { SCHEDULERJOBService } from '../../../api';
import type { GetJobsResponse } from '../../../api';
import { isMakerCheckerPending } from '../../utils/mutation-response';
import type {
  SchedulerJob,
  SchedulerJobApi,
  SchedulerJobUpdate,
  SchedulerJobUpdateOutcome,
} from './scheduler-job.api';

/** Maps one generated job response onto the application model. Exported for its own test. */
export function mapSchedulerJob(response: GetJobsResponse): SchedulerJob {
  if (response.jobId === undefined || response.jobId === null) {
    throw new Error('Fineract returned a scheduler job with no jobId');
  }
  return {
    id: response.jobId,
    displayName: response.displayName ?? '',
    cronExpression: response.cronExpression ?? '',
    // Fineract serialises both from primitive booleans, so absence only happens in a fixture.
    active: response.active === true,
    currentlyRunning: response.currentlyRunning === true,
  };
}

/** {@link SchedulerJobApi} over the generated OpenAPI client. */
@Injectable({ providedIn: 'root' })
export class FineractSchedulerJobApi implements SchedulerJobApi {
  private readonly jobs = inject(SCHEDULERJOBService);

  get(id: number): Observable<SchedulerJob> {
    return this.jobs.getJobsJobId(id).pipe(map((response) => mapSchedulerJob(response)));
  }

  update(id: number, changes: SchedulerJobUpdate): Observable<SchedulerJobUpdateOutcome> {
    return this.jobs
      .putJobsJobId(id, {
        ...changes,
        // Fineract trims before validating; trimming here keeps the stored value clean too.
        ...(changes.cronExpression === undefined
          ? {}
          : { cronExpression: changes.cronExpression.trim() }),
      })
      .pipe(map((response) => ({ pendingApproval: isMakerCheckerPending(response) })));
  }
}
