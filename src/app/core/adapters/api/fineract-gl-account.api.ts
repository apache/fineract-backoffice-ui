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
import { GeneralLedgerAccountService } from '../../../api';
import type { GetGLAccountsResponse } from '../../../api';
import type { GlAccount, GlAccountApi } from './gl-account.api';

/**
 * Maps one GL account.
 *
 * Exported for its own test. Every field on the generated response is optional, because the
 * spec marks nothing required, so this function is where the application decides what an absent
 * one means. `id` is the exception: it cannot be defaulted into anything truthful, and it is
 * what the delete and edit routes address, so an account without one is reported rather than
 * smoothed over.
 */
export function mapGlAccount(response: GetGLAccountsResponse): GlAccount {
  if (response.id === undefined || response.id === null) {
    throw new Error('Fineract returned a GL account with no id');
  }
  return {
    id: response.id,
    glCode: response.glCode ?? '',
    name: response.name ?? '',
    // `{ id, code, value }` in the payload. The screen wants the label, and binding the object
    // into a table cell is what printed `[object Object]` in the Usage column.
    type: response.type?.value ?? '',
    usage: response.usage?.value ?? '',
    disabled: response.disabled === true,
    manualEntriesAllowed: response.manualEntriesAllowed === true,
    parentId: response.parentId ?? null,
  };
}

/**
 * {@link GlAccountApi} over the generated OpenAPI client.
 *
 * One of the places allowed to import `src/app/api` — see ADR 0006 and the `files` override in
 * `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractGlAccountApi implements GlAccountApi {
  private readonly glAccounts = inject(GeneralLedgerAccountService);

  list(): Observable<GlAccount[]> {
    return this.glAccounts
      .getGlaccounts()
      .pipe(map((responses) => (responses ?? []).map((response) => mapGlAccount(response))));
  }

  delete(glAccountId: number): Observable<void> {
    return this.glAccounts.deleteGlaccountsGlAccountId(glAccountId).pipe(map(() => undefined));
  }
}
