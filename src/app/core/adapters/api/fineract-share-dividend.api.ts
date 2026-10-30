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

import { SelfDividendService } from '../../../api';
import { isMakerCheckerPending } from '../../utils/mutation-response';
import type { ShareDividendApi, ShareDividendApproveOutcome } from './share-dividend.api';

/** {@link ShareDividendApi} over the generated OpenAPI client. */
@Injectable({ providedIn: 'root' })
export class FineractShareDividendApi implements ShareDividendApi {
  private readonly dividends = inject(SelfDividendService);

  approve(productId: number, dividendId: number): Observable<ShareDividendApproveOutcome> {
    // The generated signature types the body as a string; the command carries no fields.
    return this.dividends
      .putShareproductProductIdDividendDividendId(productId, dividendId, 'approve', '{}')
      .pipe(map((response) => ({ pendingApproval: isMakerCheckerPending(response) })));
  }
}
