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

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { IonButton, IonIcon, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { PageEvent } from '../../models/table.model';

/**
 * Paginator for {@link DataTableComponent} and any other paged list.
 *
 * Replaces `mat-paginator`; Ionic has no paginator of its own. The translated labels and
 * the Fineract "unknown total" range label are carried over from the former
 * `CustomPaginatorIntl`.
 */
@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [IonButton, IonIcon, IonSelect, IonSelectOption],
  template: `
    <div class="paginator" role="navigation" [attr.aria-label]="labels().selectPage">
      <span class="items-per-page">{{ labels().itemsPerPage }}</span>

      <ion-select
        class="page-size-select"
        data-testid="paginator-page-size"
        interface="popover"
        [value]="pageSize()"
        [attr.aria-label]="labels().itemsPerPage"
        (ionChange)="onPageSizeChange($event)"
      >
        @for (size of pageSizeOptions(); track size) {
          <ion-select-option [value]="size">{{ size }}</ion-select-option>
        }
      </ion-select>

      <span class="range-label" data-testid="paginator-range-label">{{ rangeLabel() }}</span>

      <ion-button
        fill="clear"
        size="small"
        data-testid="paginator-first"
        [attr.aria-label]="labels().firstPage"
        [disabled]="!hasPrevious()"
        (click)="goTo(0)"
      >
        <ion-icon name="play-skip-back-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <ion-button
        fill="clear"
        size="small"
        data-testid="paginator-previous"
        [attr.aria-label]="labels().previousPage"
        [disabled]="!hasPrevious()"
        (click)="goTo(pageIndex() - 1)"
      >
        <ion-icon name="chevron-back-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <ion-button
        fill="clear"
        size="small"
        data-testid="paginator-next"
        [attr.aria-label]="labels().nextPage"
        [disabled]="!hasNext()"
        (click)="goTo(pageIndex() + 1)"
      >
        <ion-icon name="chevron-forward-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <ion-button
        fill="clear"
        size="small"
        data-testid="paginator-last"
        [attr.aria-label]="labels().lastPage"
        [disabled]="!hasNext()"
        (click)="goTo(lastPageIndex())"
      >
        <ion-icon name="play-skip-forward-outline" slot="icon-only"></ion-icon>
      </ion-button>
    </div>
  `,
  styles: [
    `
      .paginator {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        padding: 4px 8px;
        font-size: 12px;
        color: var(--text-muted, #666);
      }
      .page-size-select {
        min-width: 72px;
        --padding-start: 8px;
      }
      .range-label {
        margin: 0 16px;
        white-space: nowrap;
      }
      ion-button {
        --padding-start: 6px;
        --padding-end: 6px;
        margin: 0;
      }
      @media (max-width: 768px) {
        .paginator {
          grid-template-columns: auto minmax(0, 1fr) repeat(4, auto);
          display: grid;
          gap: 4px;
        }
        .page-size-select {
          min-width: 0;
        }
        .range-label {
          grid-column: 1 / 3;
          grid-row: 2;
          margin: 0;
        }
        ion-button {
          grid-row: 2;
        }
      }
    `,
  ],
})
export class PaginatorComponent {
  private readonly translate = inject(TranslateService);

  /** Total number of records. For server-side paging this comes from the API response. */
  readonly length = input(0);
  readonly pageSize = input(10);
  readonly pageIndex = input(0);
  readonly pageSizeOptions = input<number[]>([5, 10, 25, 100]);

  /**
   * Set when `length` is a real, complete count rather than a value read off a paged Fineract
   * response — e.g. the caller already holds the entire result set client-side (`localLogic` in
   * {@link DataTableComponent}). Suppresses the "of many" sentinel below: there is nothing to
   * hedge against when the count did not come from Fineract's pagination in the first place, and
   * without this a small exact total that happens to be `k * pageSize + 1` (11 records at a page
   * size of 10, or even a single record at the default page size of 10) was misread as the same
   * "there's at least one more" signal a genuinely paged response uses.
   */
  readonly exactTotal = input(false);

  readonly page = output<PageEvent>();

  /** Bumped on language change so the label computeds re-evaluate. */
  private readonly lang = signal(this.translate.currentLang);

  private readonly langChange = toSignal(this.translate.onLangChange);

  protected readonly labels = computed(() => {
    // Touch both language sources so the labels re-translate when either moves.
    this.lang();
    this.langChange();

    return {
      itemsPerPage: this.instant('COMMON.ITEMS_PER_PAGE', 'Items per page:'),
      nextPage: this.instant('COMMON.NEXT_PAGE', 'Next page'),
      previousPage: this.instant('COMMON.PREVIOUS_PAGE', 'Previous page'),
      firstPage: this.instant('COMMON.FIRST_PAGE', 'First page'),
      lastPage: this.instant('COMMON.LAST_PAGE', 'Last page'),
      selectPage: this.instant('COMMON.SELECT_PAGE', 'Select page'),
    };
  });

  protected readonly lastPageIndex = computed(() =>
    Math.max(0, Math.ceil(this.length() / this.pageSize()) - 1),
  );

  protected readonly hasPrevious = computed(() => this.pageIndex() > 0);

  protected readonly hasNext = computed(
    () => this.length() > 0 && this.pageIndex() < this.lastPageIndex(),
  );

  /**
   * Range label, e.g. `1 - 10 of 42`.
   *
   * Fineract does not return a reliable total for every paged endpoint; when the reported
   * total is exactly one record past the current page it means "there is at least one more",
   * not "there are exactly this many". That case renders as "of many" rather than a number
   * the user would otherwise read as authoritative.
   */
  protected readonly rangeLabel = computed(() => {
    const of = this.instant('COMMON.OF', 'of');
    const pageSize = this.pageSize();
    const length = Math.max(this.length(), 0);

    if (length === 0 || pageSize === 0) {
      return `0 ${of} ${length}`;
    }

    const startIndex = this.pageIndex() * pageSize;
    const endIndex =
      startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;

    if (!this.exactTotal() && length % pageSize === 1) {
      return `${startIndex + 1} - ${endIndex} ${of} ${this.instant('COMMON.MANY', 'many')}`;
    }

    return `${startIndex + 1} - ${endIndex} ${of} ${length}`;
  });

  protected goTo(pageIndex: number): void {
    const target = Math.min(Math.max(pageIndex, 0), this.lastPageIndex());
    if (target === this.pageIndex()) return;

    this.emit(target, this.pageSize());
  }

  protected onPageSizeChange(event: Event): void {
    const detail = (event as CustomEvent<{ value?: number }>).detail;
    const pageSize = Number(detail?.value ?? (event.target as HTMLInputElement)?.value);
    if (!pageSize || pageSize === this.pageSize()) return;

    // Keep the first visible record in view rather than snapping back to page one.
    const firstVisibleRecord = this.pageIndex() * this.pageSize();
    this.emit(Math.floor(firstVisibleRecord / pageSize), pageSize);
  }

  private emit(pageIndex: number, pageSize: number): void {
    this.page.emit({ pageIndex, pageSize, length: this.length() });
  }

  private instant(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return !translated || translated === key ? fallback : translated;
  }
}
