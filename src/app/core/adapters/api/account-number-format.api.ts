/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
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
import { FineractAccountNumberFormatApi } from './fineract-account-number-format.api';

/**
 * How Fineract builds the account numbers for one kind of account.
 *
 * A format exists per account type — client, loan, savings and so on — and optionally carries a
 * prefix, so a savings account can be numbered with its office or its product short name in
 * front of the sequence.
 */
export interface AccountNumberFormat {
  readonly id: number;
  /** Fineract's own label for the account type, such as `CLIENT`. */
  readonly accountType: string;
  /** The id the account type is addressed by when creating a format. */
  readonly accountTypeId: number;
  /** The prefix's label, or `null` when numbers are generated without one. */
  readonly prefix: string | null;
}

/** One choice offered by the template. */
export interface NumberFormatOption {
  readonly id: number;
  readonly name: string;
}

/**
 * What the platform allows, as the create and prefix dialogs need it.
 *
 * The prefixes are keyed by the account type's **label**, which is how Fineract keys them in
 * `prefixTypeOptions` — not by id. They differ per type: a loan can be prefixed by its product
 * short name, a client cannot.
 */
export interface AccountNumberFormatTemplate {
  readonly accountTypes: readonly NumberFormatOption[];
  readonly prefixesByAccountType: Readonly<Record<string, readonly NumberFormatOption[]>>;
}

/** Account number formats, as the application needs them. */
export interface AccountNumberFormatApi {
  /** Every configured format. Fineract answers one per account type at most. */
  list(): Observable<AccountNumberFormat[]>;

  /** The account types that have no format yet, and the prefixes each type allows. */
  template(): Observable<AccountNumberFormatTemplate>;

  /**
   * Configures the format for an account type.
   *
   * Refused with a 403 when that type already has one, since Fineract keeps at most one format
   * per type — so the screen offers only the types still available.
   */
  create(accountTypeId: number, prefixTypeId?: number | null): Observable<void>;

  /**
   * Changes a format's prefix.
   *
   * The prefix is all that can change: `PUT /accountnumberformats/{id}` carries `prefixType` and
   * nothing else, so the account type is fixed once the format exists.
   */
  setPrefix(id: number, prefixTypeId: number): Observable<void>;

  /** Removes a format, returning that account type to Fineract's default numbering. */
  delete(id: number): Observable<void>;
}

/** Injection token for the active {@link AccountNumberFormatApi}. */
export const ACCOUNT_NUMBER_FORMAT_API = new InjectionToken<AccountNumberFormatApi>(
  'AccountNumberFormatApi',
  { providedIn: 'root', factory: () => inject(FineractAccountNumberFormatApi) },
);
