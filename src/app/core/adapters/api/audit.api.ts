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

import { FineractAuditApi } from './fineract-audit.api';

/** One audited command. */
export interface AuditEntry {
  readonly id: number;
  readonly actionName: string;
  readonly entityName: string;
  readonly resourceId: number | null;
  readonly subresourceId: number | null;
  readonly maker: string;
  /** ISO-8601 timestamp, or null when Fineract sent none. */
  readonly madeOnDate: string | null;
  /** Empty when the command was never checked, as with maker-checker off. */
  readonly checker: string;
  readonly checkedOnDate: string | null;
  readonly processingResult: string;
  readonly officeId: number | null;
  readonly officeName: string;
  readonly groupId: number | null;
  readonly groupName: string;
  readonly clientId: number | null;
  readonly clientName: string;
  readonly loanId: number | null;
  readonly loanAccountNo: string;
  readonly savingsAccountId: number | null;
  readonly savingsAccountNo: string;
  /** The request body as Fineract stored it. Only the single-entry read carries it. */
  readonly commandAsJson: string | null;
}

export interface AuditPage {
  readonly items: readonly AuditEntry[];
  readonly totalFilteredRecords: number;
}

export interface AuditUserOption {
  readonly id: number;
  readonly username: string;
}

export interface AuditStatusOption {
  readonly id: number;
  /** The platform's own name for the status, e.g. `processed` or `awaiting.approval`. */
  readonly name: string;
}

/** The choices `GET /audits/searchtemplate` offers for the filter bar. */
export interface AuditSearchTemplate {
  readonly users: readonly AuditUserOption[];
  readonly actionNames: readonly string[];
  readonly entityNames: readonly string[];
  readonly statuses: readonly AuditStatusOption[];
}

/** Server-side filters and paging for the audit list. Absent fields are not sent. */
export interface AuditQuery {
  readonly actionName?: string;
  readonly entityName?: string;
  readonly resourceId?: number;
  readonly makerId?: number;
  readonly checkerId?: number;
  /** `YYYY-MM-DD`, inclusive. */
  readonly madeFrom?: string;
  /** `YYYY-MM-DD`, inclusive: the whole day counts. */
  readonly madeTo?: string;
  /** An id from `AuditSearchTemplate.statuses`. */
  readonly statusId?: number;
  readonly clientId?: number;
  readonly loanId?: number;
  readonly offset: number;
  readonly limit: number;
  readonly orderBy: string;
  readonly sortOrder: 'ASC' | 'DESC';
}

export interface AuditApi {
  /** One page of audit entries matching the query. */
  list(query: AuditQuery): Observable<AuditPage>;
  /** One entry, including its command payload. */
  get(auditId: number): Observable<AuditEntry>;
  /** The users, actions, entities and statuses the filter bar can offer. */
  searchTemplate(): Observable<AuditSearchTemplate>;
}

export const AUDIT_API = new InjectionToken<AuditApi>('AuditApi', {
  providedIn: 'root',
  factory: () => inject(FineractAuditApi),
});
