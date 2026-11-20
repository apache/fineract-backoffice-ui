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

import { InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { FineractSchedulerJobApi } from './fineract-scheduler-job.api';

/** A scheduler job, as the edit form needs it. */
export interface SchedulerJob {
  readonly id: number;
  readonly displayName: string;
  /** Quartz syntax, seconds first. Empty when Fineract sent none. */
  readonly cronExpression: string;
  readonly active: boolean;
  /** A job mid-run is shown read-only rather than rescheduled under itself. */
  readonly currentlyRunning: boolean;
}

/**
 * What editing a job can change: any of the fields `PUT /jobs/{id}` accepts.
 *
 * Partial on purpose. Fineract validates and applies only the parameters present, so sending
 * just what the administrator changed keeps a concurrent edit to another field from being
 * overwritten with a stale value.
 */
export interface SchedulerJobUpdate {
  readonly displayName?: string;
  readonly cronExpression?: string;
  readonly active?: boolean;
}

/** What came of an update. */
export interface SchedulerJobUpdateOutcome {
  /** Maker-checker queued the change for `UPDATE_SCHEDULER_CHECKER`; nothing applied yet. */
  readonly pendingApproval: boolean;
}

/**
 * Scheduler jobs, stated as the operations the edit form uses.
 *
 * Narrow on purpose (ADR 0006): the list and history screens still read the generated client,
 * and move here when they are next touched for a reason of their own.
 */
export interface SchedulerJobApi {
  get(id: number): Observable<SchedulerJob>;
  update(id: number, changes: SchedulerJobUpdate): Observable<SchedulerJobUpdateOutcome>;
}

/** Injection token for the active {@link SchedulerJobApi}; defaults to Fineract's. */
export const SCHEDULER_JOB_API = new InjectionToken<SchedulerJobApi>('SchedulerJobApi', {
  providedIn: 'root',
  factory: () => inject(FineractSchedulerJobApi),
});
