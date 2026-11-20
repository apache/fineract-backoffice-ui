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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { AUDIT_API, TranslatePipe, type AuditEntry } from '../../../core/adapters';
import { StatusBadgeComponent } from '../../../shared';
import { LoadErrorComponent } from '../../../shared/components/load-error/load-error.component';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';
import { ButtonComponent } from '../../../ui/button/button.component';
import { CardComponent } from '../../../ui/card/card.component';
import { SpinnerComponent } from '../../../ui/spinner/spinner.component';
import { maskPayload } from './audit-payload';

/** A record the audited command touched, and where its own screen lives when that is known. */
interface LinkedEntity {
  readonly labelKey: string;
  readonly text: string;
  readonly link: unknown[] | null;
  readonly testId: string;
}

/** One kind of linked record: its id and display name on the entry, and its detail route. */
interface LinkSource {
  readonly labelKey: string;
  readonly id: number | null;
  readonly name: string;
  readonly route: string;
  readonly testId: string;
}

/**
 * Where a savings-account id opens. Fineract records fixed and recurring deposit commands
 * against the same `savings_account_id`, but each has its own screen here.
 */
function savingsRoute(entityName: string): string {
  const entity = entityName.toUpperCase();
  if (entity === 'FIXEDDEPOSITACCOUNT') return '/products/fixed-deposits/view';
  if (entity === 'RECURRINGDEPOSITACCOUNT') return '/products/recurring-deposits/view';
  return '/products/savings-accounts/view';
}

/**
 * One audit entry: what was done to which record, who made and checked it, and the command
 * payload with its secrets masked.
 */
@Component({
  selector: 'app-audit-entry-view',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    DateTimePipe,
    StatusBadgeComponent,
    LoadErrorComponent,
    ButtonComponent,
    CardComponent,
    SpinnerComponent,
  ],
  template: `
    <div class="view-container">
      <app-button
        type="button"
        emphasis="quiet"
        icon="arrow-back-outline"
        [link]="['/security/audits']"
        >{{ 'COMMON.BACK' | appTranslate }}</app-button
      >

      @if (loadError() === 'forbidden') {
        <app-load-error
          testId="audit-entry-load-error"
          icon="lock-closed-outline"
          [message]="'AUDIT.NO_ACCESS' | appTranslate"
        ></app-load-error>
      } @else if (loadError() === 'not-found') {
        <app-load-error
          testId="audit-entry-load-error"
          [message]="'AUDIT.NOT_FOUND' | appTranslate"
        ></app-load-error>
      } @else if (loadError() === 'failed') {
        <app-load-error
          testId="audit-entry-load-error"
          [message]="'AUDIT.LOAD_FAILED' | appTranslate"
          [actionLabel]="'COMMON.RETRY' | appTranslate"
          (action)="load()"
        ></app-load-error>
      } @else if (entry(); as e) {
        <app-card>
          <h2 class="entry-title" data-testid="audit-entry-title">
            {{ 'AUDIT.ENTRY_TITLE' | appTranslate: { id: e.id } }}
          </h2>
          <dl class="summary" data-testid="audit-entry-summary">
            <div>
              <dt>{{ 'COMMON.ACTION' | appTranslate }}</dt>
              <dd>{{ e.actionName || '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'COMMON.ENTITY' | appTranslate }}</dt>
              <dd>{{ e.entityName || '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'SECURITY.RESOURCE_ID' | appTranslate }}</dt>
              <dd>{{ e.resourceId ?? '-' }}</dd>
            </div>
            @if (e.subresourceId !== null) {
              <div>
                <dt>{{ 'AUDIT.SUBRESOURCE_ID' | appTranslate }}</dt>
                <dd>{{ e.subresourceId }}</dd>
              </div>
            }
            <div>
              <dt>{{ 'COMMON.MAKER' | appTranslate }}</dt>
              <dd data-testid="audit-entry-maker">{{ e.maker || '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'AUDIT.MADE_ON' | appTranslate }}</dt>
              <dd>{{ (e.madeOnDate | dateTime) || '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'COMMON.CHECKER' | appTranslate }}</dt>
              <dd data-testid="audit-entry-checker">{{ e.checker || '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'COMMON.CHECKED_DATE' | appTranslate }}</dt>
              <dd>{{ (e.checkedOnDate | dateTime) || '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'SECURITY.PROCESSING_RESULT' | appTranslate }}</dt>
              <dd>
                @if (e.processingResult) {
                  <app-status-badge [status]="e.processingResult"></app-status-badge>
                } @else {
                  -
                }
              </dd>
            </div>
          </dl>

          @if (linkedEntities().length > 0) {
            <h3 class="section-title">{{ 'AUDIT.LINKED_RECORDS' | appTranslate }}</h3>
            <ul class="links" data-testid="audit-entry-links">
              @for (linked of linkedEntities(); track linked.testId) {
                <li>
                  <span class="link-label">{{ linked.labelKey | appTranslate }}</span>
                  @if (linked.link) {
                    <a [routerLink]="linked.link" [attr.data-testid]="linked.testId">{{
                      linked.text
                    }}</a>
                  } @else {
                    <span [attr.data-testid]="linked.testId">{{ linked.text }}</span>
                  }
                </li>
              }
            </ul>
          }

          <h3 class="section-title" id="audit-payload-heading">
            {{ 'AUDIT.PAYLOAD' | appTranslate }}
          </h3>
          @if (payload()) {
            <!-- A region, so the scrollable block can take focus and carry the heading as its name. -->
            <pre
              class="payload"
              data-testid="audit-entry-payload"
              role="region"
              tabindex="0"
              aria-labelledby="audit-payload-heading"
              >{{ payload() }}</pre>
          } @else {
            <p class="empty" data-testid="audit-entry-no-payload">
              {{ 'AUDIT.NO_PAYLOAD' | appTranslate }}
            </p>
          }
        </app-card>
      } @else {
        <app-spinner [label]="'COMMON.LOADING' | appTranslate" />
      }
    </div>
  `,
  styles: [
    `
      .view-container {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      .view-container > app-button {
        align-self: flex-start;
      }
      .entry-title {
        margin: 0 0 16px;
        font-size: 1.25rem;
      }
      .section-title {
        margin: 24px 0 8px;
        font-size: 1rem;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 0;
      }
      .summary dt,
      .link-label {
        color: var(--ion-color-medium);
        font-size: 0.85rem;
      }
      .summary dd {
        margin: 4px 0 0;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      .links {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px 24px;
      }
      .links li {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .payload {
        margin: 0;
        padding: 16px;
        border-radius: 4px;
        background: var(--ion-color-light);
        color: var(--ion-text-color);
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9rem;
        max-height: 480px;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .empty {
        margin: 0;
        color: var(--ion-color-medium);
      }
    `,
  ],
})
export class AuditEntryViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly audits = inject(AUDIT_API);

  readonly entry = signal<AuditEntry | null>(null);
  readonly loadError = signal<'forbidden' | 'not-found' | 'failed' | null>(null);

  /** The command payload, pretty-printed, with secrets masked before it reaches the DOM. */
  readonly payload = computed(() => maskPayload(this.entry()?.commandAsJson));

  /**
   * The records the command touched. A record links to its screen when Fineract sent its id.
   * Fineract before FINERACT-2186 sends the office, group and savings names without ids, so
   * those show as plain text rather than not at all.
   */
  readonly linkedEntities = computed<LinkedEntity[]>(() => {
    const e = this.entry();
    if (!e) return [];
    const sources: LinkSource[] = [
      {
        labelKey: 'COMMON.OFFICE',
        id: e.officeId,
        name: e.officeName,
        route: '/organization/offices/view',
        testId: 'audit-link-office',
      },
      {
        labelKey: 'AUDIT.GROUP',
        id: e.groupId,
        name: e.groupName,
        // Centres are rows of the same table as groups, with a screen of their own.
        route: e.entityName.toUpperCase() === 'CENTER' ? '/centers/view' : '/groups/view',
        testId: 'audit-link-group',
      },
      {
        labelKey: 'COMMON.CLIENT',
        id: e.clientId,
        name: e.clientName,
        route: '/clients/view',
        testId: 'audit-link-client',
      },
      {
        labelKey: 'AUDIT.LOAN',
        id: e.loanId,
        name: e.loanAccountNo,
        route: '/loans/view',
        testId: 'audit-link-loan',
      },
      {
        labelKey: 'AUDIT.SAVINGS_ACCOUNT',
        id: e.savingsAccountId,
        name: e.savingsAccountNo,
        route: savingsRoute(e.entityName),
        testId: 'audit-link-savings',
      },
    ];
    return sources
      .filter((source) => source.id !== null || source.name !== '')
      .map((source) => ({
        labelKey: source.labelKey,
        text: source.name || `#${source.id}`,
        link: source.id === null ? null : [source.route, source.id],
        testId: source.testId,
      }));
  });

  ngOnInit(): void {
    this.load();
  }

  /** The read in flight, cancelled by a retry so a slow earlier answer cannot overwrite it. */
  private loading?: Subscription;

  load(): void {
    this.loading?.unsubscribe();
    const id = Number(this.route.snapshot.paramMap.get('auditId'));
    this.loadError.set(null);
    this.entry.set(null);
    if (!Number.isInteger(id) || id <= 0) {
      this.loadError.set('not-found');
      return;
    }
    this.loading = this.audits.get(id).subscribe({
      next: (entry) => this.entry.set(entry),
      error: (err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        // Fineract answers an id outside the user's data scope the same way as a missing one.
        this.loadError.set(status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'failed');
      },
    });
  }
}
