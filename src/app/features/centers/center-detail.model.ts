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

/**
 * What `GET /centers/{id}` actually returns, and how a center differs from a group.
 *
 * A center *is* a group in the platform's data model — one at a higher `groupLevel` — and several
 * operations are only reachable through the groups resource even for a center. Each of those is
 * noted where it is used; they are not interchangeable in general, so the distinction is kept
 * explicit rather than hidden behind a shared service.
 *
 * The generated `GetCentersCenterIdResponse` omits `status`, `active`, `staffId`, `staffName` and
 * `groupMembers`, all of which this screen shows or gates an action on. Declaring the shape here
 * keeps that guesswork in one reviewable place — see the same note on `group-detail.model.ts`.
 */

import { FineractDate, GroupStatus } from '../groups/group-detail.model';

export type { FineractDate, GroupStatus };

/** A group belonging to a center, as returned under `associations=groupMembers`. */
export interface CenterGroupMember {
  id?: number;
  accountNo?: string;
  name?: string;
  status?: GroupStatus;
  active?: boolean;
  officeName?: string;
  hierarchy?: string;
}

export interface CenterTimeline {
  submittedOnDate?: FineractDate;
  submittedByUsername?: string;
  activatedOnDate?: FineractDate;
  closedOnDate?: FineractDate;
}

export interface CenterDetail {
  id?: number;
  accountNo?: string;
  name?: string;
  externalId?: string;
  status?: GroupStatus;
  active?: boolean;
  activationDate?: FineractDate;
  officeId?: number;
  officeName?: string;
  staffId?: number;
  staffName?: string;
  hierarchy?: string;
  /**
   * Present only when the read asked for it by name.
   *
   * `associations=all` returns *nothing* extra on a center — not even the group members that
   * `associations=groupMembers` returns — so the association has to be requested explicitly.
   * Verified against a live instance; it is not what the parameter's name suggests.
   */
  groupMembers?: CenterGroupMember[];
  timeline?: CenterTimeline;
}

/**
 * The center's meeting, from `GET /centers/{id}/calendars`.
 *
 * `startDate` is a `yyyy-MM-dd` string here, not the `[year, month, day]` array the rest of the
 * platform returns — the one place in this feature where a date needs no conversion.
 */
export interface CenterMeeting {
  id?: number;
  title?: string;
  startDate?: string;
  interval?: number;
  repeating?: boolean;
  recurrence?: string;
  frequency?: { id?: number; value?: string };
  type?: { id?: number; value?: string };
}

/**
 * Center status ids. Shared with groups and clients: the codes come back as
 * `groupingStatusType.pending` and the ids match {@link GROUP_STATUS}.
 *
 * Gated on the id rather than on `value`, which is the platform's English label and moves with
 * the server's locale.
 */
export const CENTER_STATUS = {
  PENDING: 100,
  ACTIVE: 300,
  CLOSED: 600,
} as const;

/** The commands `POST /centers/{id}` accepts, as reported by the platform itself. */
export const CENTER_COMMANDS = {
  ACTIVATE: 'activate',
  CLOSE: 'close',
  ASSOCIATE_GROUPS: 'associateGroups',
  DISASSOCIATE_GROUPS: 'disassociateGroups',
} as const;

export function isCenterActive(center: CenterDetail | null): boolean {
  return center?.status?.id === CENTER_STATUS.ACTIVE;
}

export function isCenterPending(center: CenterDetail | null): boolean {
  return center?.status?.id === CENTER_STATUS.PENDING;
}

export function isCenterClosed(center: CenterDetail | null): boolean {
  return center?.status?.id === CENTER_STATUS.CLOSED;
}
