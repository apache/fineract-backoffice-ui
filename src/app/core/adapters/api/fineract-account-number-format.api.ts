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

import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { AccountNumberFormatService } from '../../../api';
import type {
  GetAccountNumberFormatsIdResponse,
  GetAccountNumberFormatsResponseTemplate,
} from '../../../api';
import type {
  AccountNumberFormat,
  AccountNumberFormatApi,
  AccountNumberFormatTemplate,
  NumberFormatOption,
} from './account-number-format.api';

/**
 * Maps one configured format.
 *
 * Exported for its own test. `accountType` and `prefixType` arrive as `{ id, code, value }`, and
 * the screen wants the label; the account type's id is kept as well, because it is what the
 * prefix options are looked up by.
 */
export function mapAccountNumberFormat(
  response: GetAccountNumberFormatsIdResponse,
): AccountNumberFormat {
  if (response.id === undefined || response.id === null) {
    throw new Error('Fineract returned an account number format with no id');
  }
  return {
    id: response.id,
    accountType: response.accountType?.value ?? '',
    accountTypeId: response.accountType?.id ?? -1,
    // Absent rather than empty when no prefix is configured, which is the common case: the
    // difference between "no prefix" and "a prefix that is blank" is one the screen shows.
    prefix: response.prefixType?.value ?? null,
  };
}

function mapOptions(options: readonly { id?: number; value?: string }[]): NumberFormatOption[] {
  return options
    .filter((option): option is { id: number; value?: string } => option.id !== undefined)
    .map((option) => ({ id: option.id, name: option.value ?? '' }));
}

/** Maps the template. Exported for its own test. */
export function mapAccountNumberFormatTemplate(
  response: GetAccountNumberFormatsResponseTemplate,
): AccountNumberFormatTemplate {
  const prefixes: Record<string, readonly NumberFormatOption[]> = {};
  for (const [accountType, options] of Object.entries(response.prefixTypeOptions ?? {})) {
    prefixes[accountType] = mapOptions(options ?? []);
  }
  return {
    accountTypes: mapOptions(response.accountTypeOptions ?? []),
    prefixesByAccountType: prefixes,
  };
}

/**
 * {@link AccountNumberFormatApi} over the generated OpenAPI client.
 *
 * One of the places allowed to import `src/app/api` — see ADR 0006.
 */
@Injectable({ providedIn: 'root' })
export class FineractAccountNumberFormatApi implements AccountNumberFormatApi {
  private readonly formats = inject(AccountNumberFormatService);

  list(): Observable<AccountNumberFormat[]> {
    return this.formats
      .getAccountnumberformats()
      .pipe(map((responses) => (responses ?? []).map(mapAccountNumberFormat)));
  }

  template(): Observable<AccountNumberFormatTemplate> {
    return this.formats.getAccountnumberformatsTemplate().pipe(map(mapAccountNumberFormatTemplate));
  }

  create(accountTypeId: number, prefixTypeId?: number | null): Observable<void> {
    return this.formats
      .postAccountnumberformats({
        accountType: accountTypeId,
        // Omitted rather than sent as null when no prefix was chosen: the platform reads an
        // absent prefixType as "no prefix", and a null one as a value it cannot parse.
        ...(prefixTypeId === undefined || prefixTypeId === null
          ? {}
          : { prefixType: prefixTypeId }),
      })
      .pipe(map(() => undefined));
  }

  setPrefix(id: number, prefixTypeId: number): Observable<void> {
    return this.formats
      .putAccountnumberformatsAccountNumberFormatId(id, { prefixType: prefixTypeId })
      .pipe(map(() => undefined));
  }

  delete(id: number): Observable<void> {
    return this.formats
      .deleteAccountnumberformatsAccountNumberFormatId(id)
      .pipe(map(() => undefined));
  }
}
