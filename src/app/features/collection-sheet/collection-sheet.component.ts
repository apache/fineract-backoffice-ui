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

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { TranslatePipe } from '../../core/adapters';
import {
  CollectionSheetService,
  OfficesService,
  StaffService,
  StaffData,
  CollectionSheetRequest,
  PostCollectionSheetResponse,
} from '../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  toIsoDate,
} from '../../core/utils/date-formatter';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import { createPickersReady } from '../../shared/utils/pickers-ready';

@Component({
  selector: 'app-collection-sheet',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'COLLECTION_SHEET.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @if (isLoading()) {
          <div class="spinner-container">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        }

        @if (!generated() && !isLoading()) {
          <form #filterForm="ngForm" (ngSubmit)="generate()">
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'COLLECTION_SHEET.OFFICE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'COLLECTION_SHEET.OFFICE' | appTranslate"
                interface="popover"
                name="officeId"
                [(ngModel)]="request.officeId"
                (ngModelChange)="onOfficeChange($event)"
                required
              >
                @for (office of offices(); track office.id) {
                  <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COLLECTION_SHEET.DATE' | appTranslate }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="transactionDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="transactionDate-picker"
                    data-testid="transactionDate-picker"
                    presentation="date"
                    name="transactionDate"
                    [(ngModel)]="transactionDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <!--
              A select, not the number box this was: it asked for a staff member's database id,
              which nobody operating a branch knows. The options come from the office, the way
              Fineract scopes staff.
            -->
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'COLLECTION_SHEET.STAFF' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'COLLECTION_SHEET.STAFF' | appTranslate"
                interface="popover"
                name="staffId"
                data-testid="collection-sheet-staff"
                [disabled]="request.officeId === undefined"
                [(ngModel)]="staffId"
              >
                @for (member of staff(); track member.id) {
                  <ion-select-option [value]="member.id">{{
                    member.displayName
                  }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="actions">
              <ion-button color="primary" type="submit" [disabled]="filterForm.invalid">
                {{ 'COLLECTION_SHEET.GENERATE' | appTranslate }}
              </ion-button>
            </div>
          </form>
        }

        @if (generated() && !isLoading()) {
          <h3>{{ 'COLLECTION_SHEET.RESULTS' | appTranslate }}</h3>
          <!--
            Fineract answers command=generate with 200 and an empty body when nothing is due,
            which arrives as null. This used to print the word "null" under the heading and still
            offer Save, so the operator was invited to save nothing.
          -->
          @if (hasSheet()) {
            <pre class="json-output" data-testid="collection-sheet-results">{{
              collectionData() | json
            }}</pre>
          } @else {
            <p class="empty-state" role="status" data-testid="collection-sheet-empty">
              {{ 'COLLECTION_SHEET.NOTHING_DUE' | appTranslate }}
            </p>
          }
          <div class="actions">
            <ion-button fill="clear" (click)="back()">
              {{ 'COLLECTION_SHEET.BACK' | appTranslate }}
            </ion-button>
            @if (hasSheet()) {
              <ion-button color="primary" (click)="save()">
                {{ 'COLLECTION_SHEET.SAVE' | appTranslate }}
              </ion-button>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      ion-card {
        max-width: 640px;
        margin: 24px auto;
      }
      .full-width {
        width: 100%;
        margin-bottom: 12px;
      }
      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .json-output {
        background: var(--surface-sunken);
        color: var(--text-color);
        padding: 16px;
        border-radius: 4px;
        overflow: auto;
        max-height: 400px;
        font-size: 12px;
      }
    `,
  ],
})
export class CollectionSheetComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private collectionSheetService = inject(CollectionSheetService);
  private officesService = inject(OfficesService);
  private staffService = inject(StaffService);
  private notifications = inject(NotificationService);

  readonly generated = signal(false);
  readonly isLoading = signal(false);
  readonly collectionData = signal<PostCollectionSheetResponse | null>(null);
  transactionDate = toIsoDate(new Date());
  staffId: number | null = null;
  request: CollectionSheetRequest = { locale: 'en' };

  readonly offices = signal<{ id?: number; name?: string }[]>([]);
  readonly staff = signal<StaffData[]>([]);

  /**
   * Whether the generated sheet holds anything.
   *
   * `command=generate` answers 200 with an empty body when nothing is due in the period, which
   * `HttpClient` delivers as `null`.
   */
  readonly hasSheet = computed(() => {
    const data = this.collectionData();
    return data !== null && data !== undefined && Object.keys(data).length > 0;
  });

  ngOnInit(): void {
    this.officesService.getOffices().subscribe({
      next: (res: unknown) => {
        this.offices.set(Array.isArray(res) ? (res as { id?: number; name?: string }[]) : []);
      },
      error: () => {
        this.notifications.error('Failed to load offices');
      },
    });
  }

  /**
   * Reloads the staff list for the chosen office, and drops a selection the new office has no
   * staff member for — Fineract refuses a staffId from another office.
   */
  onOfficeChange(officeId: number | undefined): void {
    this.staffId = null;
    this.staff.set([]);
    if (officeId === undefined || officeId === null) return;

    this.staffService.getStaff(officeId).subscribe({
      next: (members: StaffData[]) => this.staff.set(members ?? []),
      error: () => this.notifications.error('Failed to load staff'),
    });
  }

  private buildBody(): CollectionSheetRequest {
    return {
      ...this.request,
      // Was collected by the form and then dropped on the floor: `staffId` is a field of its own
      // rather than part of `request`, and this method spread `request` alone.
      ...(this.staffId === null ? {} : { staffId: this.staffId }),
      transactionDate: formatDateToFineract(this.transactionDate),
      dateFormat: FINERACT_DATE_FORMAT,
    };
  }

  generate(): void {
    this.isLoading.set(true);
    const body = this.buildBody();
    this.collectionSheetService.postCollectionsheet(body, 'generate').subscribe({
      next: (res: PostCollectionSheetResponse) => {
        this.collectionData.set(res);
        this.generated.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        this.notifications.error('Failed to generate collection sheet');
        this.isLoading.set(false);
      },
    });
  }

  save(): void {
    this.isLoading.set(true);
    const body = this.buildBody();
    this.collectionSheetService.postCollectionsheet(body, 'save').subscribe({
      next: () => {
        this.notifications.success('Collection sheet saved successfully');
        this.isLoading.set(false);
        this.back();
      },
      error: () => {
        this.notifications.error('Failed to save collection sheet');
        this.isLoading.set(false);
      },
    });
  }

  back(): void {
    this.generated.set(false);
    this.collectionData.set(null);
  }
}
