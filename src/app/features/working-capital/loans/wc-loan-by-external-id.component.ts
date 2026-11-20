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

import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe, WORKING_CAPITAL_LOAN_API } from '../../../core/adapters';
import { LoadErrorComponent } from '../../../shared';
import { SpinnerComponent } from '../../../ui/spinner/spinner.component';

/**
 * Opens a working-capital loan by the external id the institution assigned it.
 *
 * Fineract addresses every working-capital resource twice, by its own numeric id and by the
 * external id, and this application only ever used the numeric half — so an operator holding
 * their own reference had to find the loan by scrolling the list. This resolves the reference
 * and hands over to the ordinary loan view, replacing the URL so the back button returns to
 * wherever the operator came from rather than to this redirect.
 *
 * It renders only while resolving, or when the reference matched nothing: a loan that is found
 * is somebody else's screen.
 */
@Component({
  selector: 'app-wc-loan-by-external-id',
  standalone: true,
  imports: [TranslatePipe, LoadErrorComponent, SpinnerComponent],
  template: `
    <div class="lookup-container">
      @if (notFound()) {
        <app-load-error
          testId="wc-external-id-not-found"
          icon="search-outline"
          [message]="'WC_LOANS.EXTERNAL_ID_NOT_FOUND' | appTranslate: { externalId: externalId }"
          [actionLabel]="'COMMON.BACK' | appTranslate"
          (action)="onBackToList()"
        ></app-load-error>
      } @else if (loadError()) {
        <app-load-error
          testId="wc-external-id-error"
          [message]="'WC_LOANS.LOOKUP_FAILED' | appTranslate"
          [actionLabel]="'COMMON.RETRY' | appTranslate"
          (action)="resolve()"
        ></app-load-error>
      } @else {
        <app-spinner data-testid="wc-external-id-resolving" />
      }
    </div>
  `,
  styles: [
    `
      .lookup-container {
        padding: 24px;
        max-width: 720px;
        margin: 0 auto;
      }
    `,
  ],
})
export class WcLoanByExternalIdComponent implements OnInit {
  private readonly loans = inject(WORKING_CAPITAL_LOAN_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  externalId = '';
  readonly notFound = signal(false);
  readonly loadError = signal(false);

  ngOnInit(): void {
    this.externalId = this.route.snapshot.paramMap.get('externalId') ?? '';
    this.resolve();
  }

  resolve(): void {
    this.notFound.set(false);
    this.loadError.set(false);
    if (this.externalId === '') {
      this.notFound.set(true);
      return;
    }

    this.loans.findByExternalId(this.externalId).subscribe({
      next: (loan) => {
        if (loan === null) {
          this.notFound.set(true);
          return;
        }
        void this.router.navigate(['/working-capital/loans/view', loan.id], { replaceUrl: true });
      },
      error: () => this.loadError.set(true),
    });
  }

  onBackToList(): void {
    void this.router.navigate(['/working-capital/loans']);
  }
}
