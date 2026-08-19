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
import { DatePipe } from '@angular/common';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

import { GetOfficesResponse, OfficesService, StaffService } from '../../../api';
import { TranslatePipe } from '../../../core/adapters';
import { EntityDatatablesComponent } from '../../../shared/components/entity-datatables/entity-datatables.component';
import { RequiresPermissionDirective } from '../../../shared';

/**
 * An office as a record rather than a row.
 *
 * The list gives a name and a parent; this shows what the branch actually is — where it sits in
 * the hierarchy, when it opened, who works there, and any tenant-defined fields registered against
 * `m_office`. Those custom fields are the reason this screen exists at all: a tenant can register
 * a data table against an office and, without a detail screen, has nowhere to read or write it.
 */
/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const OFFICE_TAB = {
  general: 'general',
  staff: 'staff',
  customFields: 'customFields',
} as const;

export type OfficeTab = (typeof OFFICE_TAB)[keyof typeof OFFICE_TAB];

@Component({
  selector: 'app-office-view',
  standalone: true,
  imports: [
    TranslatePipe,
    DatePipe,
    EntityDatatablesComponent,
    RequiresPermissionDirective,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSpinner,
  ],
  template: `
    <div class="view-container">
      @if (isLoading()) {
        <ion-spinner data-testid="office-loading"></ion-spinner>
      } @else if (office(); as branch) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ branch.name }}</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <ion-segment
              [value]="activeTab()"
              (ionChange)="activeTab.set($any($event).detail.value)"
            >
              <ion-segment-button [value]="TAB.general" data-testid="office-tab-general">
                <ion-label>{{ 'COMMON.GENERAL' | appTranslate }}</ion-label>
              </ion-segment-button>
              <ion-segment-button [value]="TAB.staff" data-testid="office-tab-staff">
                <ion-label>{{ 'OFFICES.STAFF' | appTranslate }}</ion-label>
              </ion-segment-button>
              <ion-segment-button [value]="TAB.customFields" data-testid="office-tab-custom-fields">
                <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | appTranslate }}</ion-label>
              </ion-segment-button>
            </ion-segment>

            @if (activeTab() === TAB.general) {
              <dl class="detail-grid">
                <dt>{{ 'COMMON.NAME' | appTranslate }}</dt>
                <dd>{{ branch.name }}</dd>

                <dt>{{ 'OFFICES.HIERARCHY' | appTranslate }}</dt>
                <dd>{{ branch.hierarchy }}</dd>

                <dt>{{ 'OFFICES.OPENING_DATE' | appTranslate }}</dt>
                <dd>{{ branch.openingDate | date: 'mediumDate' }}</dd>

                @if (branch.externalId) {
                  <dt>{{ 'COMMON.EXTERNAL_ID' | appTranslate }}</dt>
                  <dd>{{ branch.externalId }}</dd>
                }
              </dl>

              <div class="actions">
                <ion-button fill="outline" (click)="onBack()">
                  {{ 'COMMON.BACK' | appTranslate }}
                </ion-button>
                <ion-button
                  data-testid="office-edit"
                  appRequiresPermission="UPDATE_OFFICE"
                  (click)="onEdit()"
                >
                  <ion-icon name="create-outline" slot="start"></ion-icon>
                  {{ 'COMMON.EDIT' | appTranslate }}
                </ion-button>
              </div>
            }

            @if (activeTab() === TAB.staff) {
              @if (staff().length === 0) {
                <p data-testid="office-staff-empty">{{ 'OFFICES.NO_STAFF' | appTranslate }}</p>
              } @else {
                <ul class="staff-list" data-testid="office-staff-list">
                  @for (member of staff(); track member.id) {
                    <li>{{ member.displayName }}</li>
                  }
                </ul>
              }
            }

            @if (activeTab() === TAB.customFields) {
              <app-entity-datatables
                apptableName="m_office"
                [entityId]="branch.id!"
              ></app-entity-datatables>
            }
          </ion-card-content>
        </ion-card>
      } @else {
        <p data-testid="office-missing">{{ 'OFFICES.NOT_FOUND' | appTranslate }}</p>
      }
    </div>
  `,
  styles: [
    `
      .view-container {
        padding: 16px;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 24px;
        margin: 16px 0;
      }
      .detail-grid dt {
        font-weight: 600;
      }
      .detail-grid dd {
        margin: 0;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .staff-list {
        margin: 16px 0;
        padding-left: 20px;
      }
    `,
  ],
})
export class OfficeViewComponent implements OnInit {
  private readonly officesService = inject(OfficesService);
  private readonly staffService = inject(StaffService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly office = signal<GetOfficesResponse | null>(null);
  readonly staff = signal<{ id?: number; displayName?: string }[]>([]);
  readonly isLoading = signal(true);
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = OFFICE_TAB;

  readonly activeTab = signal<OfficeTab>(OFFICE_TAB.general);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) {
      this.isLoading.set(false);
      return;
    }

    this.officesService.getOfficesOfficeId(id).subscribe({
      next: (office) => {
        this.office.set(office);
        this.isLoading.set(false);
      },
      error: () => {
        this.office.set(null);
        this.isLoading.set(false);
      },
    });

    this.staffService.getStaff(id).subscribe({
      next: (members) => this.staff.set(members ?? []),
      error: () => this.staff.set([]),
    });
  }

  onEdit(): void {
    void this.router.navigate(['/organization/offices/edit', this.office()?.id]);
  }

  onBack(): void {
    void this.router.navigate(['/organization/offices']);
  }
}
