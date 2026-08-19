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

import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';

import {
  BASE_PATH,
  CentersService,
  GroupsService,
  PostCentersCenterIdRequest,
  PostGroupsGroupIdRequest,
} from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { DialogService } from '../../core/services/dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
} from '../../core/utils/date-formatter';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
  RequiresPermissionDirective,
  StatusBadgeComponent,
} from '../../shared';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';
import { GroupNotesListComponent } from '../groups/tabs/group-notes-list.component';
import {
  CenterActionDialogComponent,
  CenterActionDialogData,
  CenterActionResult,
} from './center-action-dialog.component';
import {
  CenterGroupsDialogComponent,
  CenterGroupsDialogData,
  CenterGroupsResult,
} from './center-groups-dialog.component';
import {
  CenterMeetingDialogComponent,
  CenterMeetingDialogData,
  CenterMeetingResult,
} from './center-meeting-dialog.component';
import {
  CenterStaffDialogComponent,
  CenterStaffDialogData,
  CenterStaffResult,
} from './center-staff-dialog.component';
import {
  CENTER_COMMANDS,
  CenterDetail,
  CenterGroupMember,
  CenterMeeting,
  isCenterActive,
  isCenterClosed,
  isCenterPending,
} from './center-detail.model';

/** A tab index that is also what the segment binds to; `ion-segment` deals in strings. */
/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '2' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const CENTER_TAB = {
  general: 'general',
  notes: 'notes',
  customFields: 'customFields',
} as const;

export type CenterTab = (typeof CENTER_TAB)[keyof typeof CENTER_TAB];

@Component({
  selector: 'app-center-view',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
    StatusBadgeComponent,
    EntityDatatablesComponent,
    GroupNotesListComponent,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonSegment,
    IonSegmentButton,
  ],
  template: `
    <div class="page-container">
      @if (loadFailed()) {
        <div class="load-error" data-testid="center-load-error">
          <p>{{ 'CENTERS.LOAD_FAILED' | appTranslate }}</p>
          <ion-button size="small" (click)="loadCenter()">
            {{ 'COMMON.RETRY' | appTranslate }}
          </ion-button>
        </div>
      } @else if (center(); as detail) {
        <ion-card>
          <ion-card-header>
            <div class="header-row">
              <div>
                <ion-card-title>
                  <h1 data-testid="center-name">{{ detail.name }}</h1>
                </ion-card-title>
                <div class="subtitle">
                  <app-status-badge
                    data-testid="center-status"
                    [status]="detail.status?.value ?? ''"
                  ></app-status-badge>
                  <span class="account-no">{{ detail.accountNo }}</span>
                </div>
              </div>

              <div class="header-actions">
                <ion-button
                  color="primary"
                  id="center-actions-trigger"
                  data-testid="center-actions"
                >
                  {{ 'COMMON.ACTIONS' | appTranslate }}
                  <ion-icon name="ellipsis-vertical-outline" slot="end"></ion-icon>
                </ion-button>
                <ion-popover trigger="center-actions-trigger" [dismissOnSelect]="true">
                  <ng-template>
                    <ion-list>
                      @if (canActivate()) {
                        <ion-item
                          button
                          data-testid="center-action-activate"
                          (click)="onAction('activate')"
                          appRequiresPermission="ACTIVATE_CENTER"
                        >
                          <ion-label>{{ 'CENTERS.ACTIVATE' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                      @if (canClose()) {
                        <ion-item
                          button
                          data-testid="center-action-close"
                          (click)="onAction('close')"
                          appRequiresPermission="CLOSE_CENTER"
                        >
                          <ion-label>{{ 'CENTERS.CLOSE' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                      @if (!isClosed()) {
                        <ion-item
                          button
                          data-testid="center-action-assign-staff"
                          (click)="onAssignStaff()"
                          appRequiresPermission="UPDATE_CENTER"
                        >
                          <ion-label>{{ 'CENTERS.ASSIGN_STAFF' | appTranslate }}</ion-label>
                        </ion-item>
                        @if (detail.staffId) {
                          <ion-item
                            button
                            data-testid="center-action-unassign-staff"
                            (click)="onUnassignStaff()"
                            appRequiresPermission="UNASSIGNSTAFF_GROUP"
                          >
                            <ion-label>{{ 'CENTERS.UNASSIGN_STAFF' | appTranslate }}</ion-label>
                          </ion-item>
                        }
                        @if (canScheduleMeeting()) {
                          <ion-item
                            button
                            data-testid="center-action-meeting"
                            (click)="onScheduleMeeting()"
                            appRequiresPermission="CREATE_MEETING"
                          >
                            <ion-label>
                              {{
                                (meeting() ? 'CENTERS.EDIT_MEETING' : 'CENTERS.ATTACH_MEETING')
                                  | appTranslate
                              }}
                            </ion-label>
                          </ion-item>
                        }
                        <ion-item
                          button
                          data-testid="center-action-attach-groups"
                          (click)="onManageGroups('add')"
                          appRequiresPermission="ASSOCIATEGROUPS_CENTER"
                        >
                          <ion-label>{{ 'CENTERS.ATTACH_GROUPS' | appTranslate }}</ion-label>
                        </ion-item>
                        @if (groupMembers().length) {
                          <ion-item
                            button
                            data-testid="center-action-detach-groups"
                            (click)="onManageGroups('remove')"
                            appRequiresPermission="DISASSOCIATEGROUPS_CENTER"
                          >
                            <ion-label>{{ 'CENTERS.DETACH_GROUPS' | appTranslate }}</ion-label>
                          </ion-item>
                        }
                        <ion-item
                          button
                          data-testid="center-action-edit"
                          [routerLink]="['/centers/edit', centerId]"
                          appRequiresPermission="UPDATE_CENTER"
                        >
                          <ion-label>{{ 'COMMON.EDIT' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                    </ion-list>
                  </ng-template>
                </ion-popover>
                <ion-button fill="clear" data-testid="center-back" (click)="onBack()">
                  {{ 'COMMON.BACK' | appTranslate }}
                </ion-button>
              </div>
            </div>
          </ion-card-header>

          <ion-card-content>
            <ion-segment
              [value]="activeTab()"
              (ionChange)="activeTab.set($any($event).detail.value)"
            >
              <ion-segment-button [value]="TAB.general" data-testid="center-tab-general">
                <ion-label>{{ 'COMMON.GENERAL' | appTranslate }}</ion-label>
              </ion-segment-button>
              <ion-segment-button [value]="TAB.notes" data-testid="center-tab-notes">
                <ion-label>{{ 'COMMON.NOTES' | appTranslate }}</ion-label>
              </ion-segment-button>
              <ion-segment-button [value]="TAB.customFields" data-testid="center-tab-datatables">
                <ion-label>{{ 'COMMON.DATA_TABLES' | appTranslate }}</ion-label>
              </ion-segment-button>
            </ion-segment>

            @switch (activeTab()) {
              @case (TAB.general) {
                <div class="summary-grid">
                  <div class="summary-item">
                    <span class="label">{{ 'COMMON.OFFICE' | appTranslate }}</span>
                    <span class="value" data-testid="center-office">{{ detail.officeName }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">{{ 'COMMON.STAFF' | appTranslate }}</span>
                    <span class="value" data-testid="center-staff-name">
                      {{ detail.staffName || ('COMMON.UNASSIGNED' | appTranslate) }}
                    </span>
                  </div>
                  <div class="summary-item">
                    <span class="label">{{ 'CENTERS.ACTIVATION_DATE' | appTranslate }}</span>
                    <span class="value" data-testid="center-activation-date">
                      {{ activationDate() || '—' }}
                    </span>
                  </div>
                  <div class="summary-item">
                    <span class="label">{{ 'CENTERS.MEETING' | appTranslate }}</span>
                    <span class="value" data-testid="center-meeting">
                      {{ meetingSummary() }}
                    </span>
                  </div>
                  <div class="summary-item">
                    <span class="label">{{ 'CENTERS.GROUP_COUNT' | appTranslate }}</span>
                    <span class="value" data-testid="center-group-count">
                      {{ groupMembers().length }}
                    </span>
                  </div>
                </div>

                <h3 class="section-title">{{ 'CENTERS.GROUPS' | appTranslate }}</h3>
                <app-data-table
                  data-testid="center-groups-table"
                  [columns]="groupColumns"
                  [data]="groupMembers()"
                  [totalRecords]="groupMembers().length"
                  [showSearch]="true"
                  [localLogic]="true"
                >
                  <ng-template appCellTemplate="name" let-row>
                    <a [routerLink]="['/groups/view', row.id]" data-testid="center-group-link">
                      {{ row.name }}
                    </a>
                  </ng-template>
                  <ng-template appCellTemplate="status" let-row>
                    <app-status-badge [status]="row.status?.value ?? ''"></app-status-badge>
                  </ng-template>
                </app-data-table>
              }
              @case (TAB.notes) {
                <!--
                  Notes are read and written through the *groups* resource.
                  POST /centers/{id}/notes answers 404 "Note does not support resource centers",
                  while /groups/{centerId}/notes works and stores a note of type "Group note" —
                  a center is a group at a higher level in the platform's model.
                -->
                <app-group-notes-list
                  [groupId]="centerId"
                  [basePath]="'/centers'"
                  data-testid="center-notes"
                ></app-group-notes-list>
              }
              @case (TAB.customFields) {
                <app-entity-datatables
                  data-testid="center-datatables"
                  [entityId]="centerId"
                  apptableName="m_center"
                ></app-entity-datatables>
              }
            }
          </ion-card-content>
        </ion-card>
      }
    </div>
  `,
  styles: [
    `
      .page-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
      }
      h1 {
        margin: 0;
        font-size: 1.5rem;
      }
      .subtitle {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .account-no {
        color: var(--text-muted, #6b7280);
        font-size: 13px;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .summary-item .label {
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
      .summary-item .value {
        font-weight: 600;
      }
      .section-title {
        margin-top: 32px;
        margin-bottom: 8px;
      }
      .load-error {
        text-align: center;
        padding: 48px 16px;
      }
    `,
  ],
})
export class CenterViewComponent implements OnInit {
  private readonly centersService = inject(CentersService);
  private readonly groupsService = inject(GroupsService);
  private readonly httpClient = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = CENTER_TAB;

  centerId = 0;
  readonly center = signal<CenterDetail | null>(null);
  readonly meeting = signal<CenterMeeting | null>(null);
  readonly loadFailed = signal(false);
  readonly activeTab = signal<CenterTab>(CENTER_TAB.general);

  readonly groupColumns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'accountNo', label: 'COMMON.ACCOUNT_NO', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: false },
  ];

  readonly groupMembers = computed<CenterGroupMember[]>(() => this.center()?.groupMembers ?? []);
  readonly activationDate = computed(() =>
    formatArrayDate(this.center()?.timeline?.activatedOnDate),
  );

  /**
   * A meeting cannot start before the center was activated — the platform answers
   * `validation.msg.calendar.cannot.be.before.centers.activation.date` — so the action is not
   * offered until it is.
   */
  readonly canScheduleMeeting = computed(() => isCenterActive(this.center()));
  readonly meetingSummary = computed(() => {
    const meeting = this.meeting();
    if (!meeting) return '—';
    const frequency = meeting.frequency?.value ?? '';
    return frequency ? `${meeting.title} (${frequency})` : (meeting.title ?? '—');
  });

  readonly canActivate = computed(() => isCenterPending(this.center()));
  readonly canClose = computed(() => isCenterActive(this.center()));
  readonly isClosed = computed(() => isCenterClosed(this.center()));

  ngOnInit(): void {
    this.centerId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadCenter();
  }

  /**
   * Reads the center together with its groups.
   *
   * Goes through `HttpClient` rather than `getCentersCenterId`, whose generated signature carries
   * no `associations` parameter — the same gap the deposit account view works around. Without the
   * parameter the response has no `groupMembers` key at all, so the groups tab would be empty by
   * construction rather than because the center has none. `associations=all` does *not* serve
   * here either: on a center it returns nothing beyond the base fields.
   */
  loadCenter(): void {
    this.loadFailed.set(false);

    this.httpClient
      .get<CenterDetail>(`${this.basePath}/v1/centers/${this.centerId}`, {
        params: { associations: 'groupMembers' },
      })
      .subscribe({
        next: (detail) => {
          this.center.set(detail);
          this.loadMeeting();
        },
        error: () => {
          this.center.set(null);
          this.loadFailed.set(true);
        },
      });
  }

  /**
   * Reads the center's meeting.
   *
   * A center has at most one in practice, so the first calendar is the meeting. A failure here is
   * deliberately not escalated to the whole page: the meeting is one field of the summary, and a
   * center with an unreadable calendar is still worth showing.
   */
  private loadMeeting(): void {
    this.httpClient
      .get<CenterMeeting[]>(`${this.basePath}/v1/centers/${this.centerId}/calendars`)
      .subscribe({
        next: (calendars) => this.meeting.set(calendars?.[0] ?? null),
        error: () => this.meeting.set(null),
      });
  }

  async onScheduleMeeting(): Promise<void> {
    const existing = this.meeting();
    const result = await this.dialogService.open<CenterMeetingResult>(
      CenterMeetingDialogComponent,
      {
        data: {
          centerId: this.centerId,
          meeting: existing ?? undefined,
        } satisfies CenterMeetingDialogData,
      },
    );
    if (!result) return;

    const payload = {
      title: result.title,
      startDate: formatDateToFineract(result.startDate),
      frequency: result.frequency,
      interval: result.interval,
      typeId: result.typeId,
      repeating: true,
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
      ...(result.repeatsOnDay === undefined ? {} : { repeatsOnDay: result.repeatsOnDay }),
    };
    const url = `${this.basePath}/v1/centers/${this.centerId}/calendars`;

    this.run(
      existing?.id
        ? this.httpClient.put(`${url}/${existing.id}`, payload)
        : this.httpClient.post(url, payload),
    );
  }

  async onAction(command: 'activate' | 'close'): Promise<void> {
    const result = await this.dialogService.open<CenterActionResult>(CenterActionDialogComponent, {
      data: { command } satisfies CenterActionDialogData,
    });
    if (!result) return;

    const payload: Record<string, unknown> = {
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    };
    if (command === 'activate') {
      payload['activationDate'] = formatDateToFineract(result.date);
    } else {
      payload['closureDate'] = formatDateToFineract(result.date);
      payload['closureReasonId'] = result.closureReasonId;
    }

    // The generated request types describe neither the closure fields nor `groupMembers`; the
    // platform accepts both. Casting at the call site keeps the untyped surface visible.
    this.run(
      this.centersService.postCentersCenterId(
        this.centerId,
        payload as PostCentersCenterIdRequest,
        command,
      ),
    );
  }

  async onAssignStaff(): Promise<void> {
    const detail = this.center();
    const result = await this.dialogService.open<CenterStaffResult>(CenterStaffDialogComponent, {
      data: {
        officeId: detail?.officeId,
        staffId: detail?.staffId,
      } satisfies CenterStaffDialogData,
    });
    if (!result) return;

    // Assignment is an update, not a command: the platform exposes no `assignStaff` on a center.
    // `name` is mandatory on the update even though it is not being changed — omitting it answers
    // `validation.msg.center.name.cannot.be.blank`.
    this.run(
      this.httpClient.put(`${this.basePath}/v1/centers/${this.centerId}`, {
        name: detail?.name,
        staffId: result.staffId,
        locale: FINERACT_LOCALE,
        dateFormat: FINERACT_DATE_FORMAT,
      }),
    );
  }

  async onUnassignStaff(): Promise<void> {
    const staffId = this.center()?.staffId;
    if (!staffId) return;

    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('CENTERS.UNASSIGN_STAFF'),
      message: this.i18n.translate('CENTERS.CONFIRM_UNASSIGN_STAFF'),
    });
    if (!confirmed) return;

    // Unassignment has no center-side command, and the update path cannot express it either:
    // `staffId: null` is ignored (the response reports no changes) and `staffId: -1` is rejected
    // for not being greater than zero. It is reachable only through the groups resource, which
    // accepts it for a center — and which rejects `locale` and `dateFormat` as unsupported, so
    // the payload carries the staff id alone.
    this.run(
      this.groupsService.postGroupsGroupId(
        this.centerId,
        { staffId } as unknown as PostGroupsGroupIdRequest,
        'unassignStaff',
      ),
    );
  }

  async onManageGroups(mode: 'add' | 'remove'): Promise<void> {
    const result = await this.dialogService.open<CenterGroupsResult>(CenterGroupsDialogComponent, {
      data: {
        mode,
        officeId: this.center()?.officeId,
        members: this.groupMembers(),
      } satisfies CenterGroupsDialogData,
    });
    if (!result) return;

    const command =
      mode === 'add' ? CENTER_COMMANDS.ASSOCIATE_GROUPS : CENTER_COMMANDS.DISASSOCIATE_GROUPS;
    this.run(
      this.centersService.postCentersCenterId(
        this.centerId,
        { groupMembers: result.groupMembers } as unknown as PostCentersCenterIdRequest,
        command,
      ),
    );
  }

  onBack(): void {
    void this.router.navigate(['/centers']);
  }

  private run(request: Observable<unknown>): void {
    request.subscribe({
      next: () => {
        this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
        this.loadCenter();
      },
      error: () => this.notifications.error(this.i18n.translate('COMMON.ERROR')),
    });
  }
}
