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
import { HttpClient } from '@angular/common/http';
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
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
  RequiresPermissionDirective,
  StatusBadgeComponent,
} from '../../shared';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { BASE_PATH, GroupsService } from '../../api';
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
  GROUP_STATUS,
  FineractDate,
  GroupClientMember,
  GroupDetail,
  GroupRoleAssignment,
} from './group-detail.model';
import {
  GroupActionDialogComponent,
  GroupActionDialogData,
  GroupActionResult,
} from './group-action-dialog.component';
import {
  GroupMembersDialogComponent,
  GroupMembersDialogData,
  GroupMembersResult,
} from './group-members-dialog.component';
import {
  GroupRoleDialogComponent,
  GroupRoleDialogData,
  GroupRoleResult,
} from './group-role-dialog.component';
import {
  GroupStaffDialogComponent,
  GroupStaffDialogData,
  GroupStaffResult,
} from './group-staff-dialog.component';
import { GroupNotesListComponent } from './tabs/group-notes-list.component';
import { GroupAccountsTabComponent } from './tabs/group-accounts-tab.component';
import { EntityDocumentsComponent } from '../../shared/components/entity-documents/entity-documents.component';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';

/** A tab index that is also what the segment binds to; `ion-segment` deals in strings. */

/**
 * The group detail screen: summary, membership, committee and notes, plus the lifecycle
 * commands the platform exposes for a group (issue #180).
 *
 * Before this existed the Groups feature was a list and a create form, so a group could be made
 * and then never looked at again — an officer had no way to see who was in one, and no way to
 * activate, close, staff or amend it. Group lending is the product this application gates behind
 * the `mfis` institution type, so the gap was the difference between advertising the feature and
 * having it.
 *
 * The group is fetched with `associations=all`, which is what makes `clientMembers` and
 * `groupRoles` present at all — without it the response carries the summary only and both tabs
 * render empty against a group that has members. See {@link GroupDetail} for why the response is
 * typed here rather than taken from the generated client.
 */
/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const GROUP_TAB = {
  general: 'general',
  members: 'members',
  committee: 'committee',
  notes: 'notes',
  accounts: 'accounts',
  documents: 'documents',
  customFields: 'customFields',
} as const;

export type GroupTab = (typeof GROUP_TAB)[keyof typeof GROUP_TAB];

@Component({
  selector: 'app-group-view',
  standalone: true,
  imports: [
    GroupAccountsTabComponent,
    EntityDocumentsComponent,
    EntityDatatablesComponent,
    RouterModule,
    TranslatePipe,
    StatusBadgeComponent,
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
    TooltipDirective,
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
    @if (hasError()) {
      <div class="load-error" data-testid="group-load-error">
        <ion-icon name="alert-circle-outline"></ion-icon>
        <p>{{ 'GROUPS.LOAD_FAILED' | appTranslate }}</p>
        <ion-button color="primary" (click)="loadGroup()">
          {{ 'COMMON.RETRY' | appTranslate }}
        </ion-button>
      </div>
    } @else if (group(); as detail) {
      <div class="view-container">
        <ion-card class="header-card">
          <ion-card-content>
            <div class="header">
              <div class="identity">
                <h1 data-testid="group-name">{{ detail.name }}</h1>
                <div class="sub">
                  <span class="account-no">#{{ detail.accountNo }}</span>
                  <app-status-badge
                    data-testid="group-status"
                    [status]="detail.status"
                  ></app-status-badge>
                </div>
              </div>

              <div class="header-actions">
                <ion-button color="primary" id="group-actions-trigger" data-testid="group-actions">
                  <ion-icon name="ellipsis-vertical-outline"></ion-icon>
                  {{ 'COMMON.ACTIONS' | appTranslate }}
                </ion-button>

                <ion-popover trigger="group-actions-trigger" [dismissOnSelect]="true">
                  <ng-template>
                    <ion-list>
                      @if (isPending()) {
                        <ion-item
                          button
                          data-testid="group-action-activate"
                          (click)="onActivate()"
                          appRequiresPermission="ACTIVATE_GROUP"
                        >
                          <ion-icon slot="start" name="play-circle-outline"></ion-icon>
                          <ion-label>{{ 'GROUPS.ACTIVATE' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                      @if (isActive()) {
                        <ion-item
                          button
                          data-testid="group-action-close"
                          (click)="onClose()"
                          appRequiresPermission="CLOSE_GROUP"
                        >
                          <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                          <ion-label>{{ 'GROUPS.CLOSE' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                      @if (!isClosed()) {
                        <ion-item
                          button
                          data-testid="group-action-assign-staff"
                          (click)="onAssignStaff()"
                          appRequiresPermission="ASSIGNSTAFF_GROUP"
                        >
                          <ion-icon slot="start" name="person-add-outline"></ion-icon>
                          <ion-label>{{ 'GROUPS.ASSIGN_STAFF' | appTranslate }}</ion-label>
                        </ion-item>
                        @if (detail.staffId) {
                          <ion-item
                            button
                            data-testid="group-action-unassign-staff"
                            (click)="onUnassignStaff()"
                            appRequiresPermission="UNASSIGNSTAFF_GROUP"
                          >
                            <ion-icon slot="start" name="person-remove-outline"></ion-icon>
                            <ion-label>{{ 'GROUPS.UNASSIGN_STAFF' | appTranslate }}</ion-label>
                          </ion-item>
                        }
                        <ion-item
                          button
                          data-testid="group-action-edit"
                          [routerLink]="['/groups/edit', groupId]"
                          appRequiresPermission="UPDATE_GROUP"
                        >
                          <ion-icon slot="start" name="create-outline"></ion-icon>
                          <ion-label>{{ 'COMMON.EDIT' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                    </ion-list>
                  </ng-template>
                </ion-popover>

                <ion-button fill="clear" (click)="onBack()">
                  <ion-icon name="arrow-back-outline"></ion-icon>
                  {{ 'COMMON.BACK' | appTranslate }}
                </ion-button>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <div class="content-body">
          <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
            <ion-segment-button [value]="TAB.general" data-testid="group-tab-general">
              <ion-label>{{ 'GROUPS.GENERAL' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.members" data-testid="group-tab-members">
              <ion-label>{{ 'GROUPS.MEMBERS' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.committee" data-testid="group-tab-committee">
              <ion-label>{{ 'GROUPS.COMMITTEE' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.accounts" data-testid="group-tab-accounts">
              <ion-label>{{ 'COMMON.ACCOUNTS' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.documents" data-testid="group-tab-documents">
              <ion-label>{{ 'SAVINGS.DOCUMENTS' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.customFields" data-testid="group-tab-custom-fields">
              <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.notes" data-testid="group-tab-notes">
              <ion-label>{{ 'GROUPS.NOTES' | appTranslate }}</ion-label>
            </ion-segment-button>
          </ion-segment>

          @if (activeTab() === TAB.general) {
            <div class="tab-content">
              <ion-card>
                <ion-card-header>
                  <ion-card-title>{{ 'GROUPS.SUMMARY' | appTranslate }}</ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.ACCOUNT_NO' | appTranslate }}</span>
                    <span class="value">{{ detail.accountNo || '-' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.OFFICE' | appTranslate }}</span>
                    <span class="value">{{ detail.officeName || '-' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.STAFF' | appTranslate }}</span>
                    <span class="value" data-testid="group-staff-name">
                      {{ detail.staffName || ('GROUPS.UNASSIGNED' | appTranslate) }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'GROUPS.EXTERNAL_ID' | appTranslate }}</span>
                    <span class="value">{{ detail.externalId || '-' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'GROUPS.SUBMITTED_ON' | appTranslate }}</span>
                    <span class="value">{{ displayDate(detail.timeline?.submittedOnDate) }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'GROUPS.ACTIVATED_ON' | appTranslate }}</span>
                    <span class="value">{{ displayDate(detail.activationDate) }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'GROUPS.MEMBER_COUNT' | appTranslate }}</span>
                    <span class="value" data-testid="group-member-count">{{
                      members().length
                    }}</span>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          }

          @if (activeTab() === TAB.members) {
            <div class="tab-content">
              <div class="tab-actions">
                <ion-button
                  color="primary"
                  data-testid="group-add-members"
                  [disabled]="isClosed()"
                  (click)="onAddMembers()"
                  appRequiresPermission="ASSOCIATECLIENTS_GROUP"
                >
                  <ion-icon name="person-add-outline"></ion-icon>
                  {{ 'GROUPS.ADD_MEMBERS' | appTranslate }}
                </ion-button>
                <ion-button
                  color="medium"
                  fill="outline"
                  data-testid="group-remove-members"
                  [disabled]="isClosed() || !members().length"
                  (click)="onRemoveMembers()"
                  appRequiresPermission="DISASSOCIATECLIENTS_GROUP"
                >
                  <ion-icon name="person-remove-outline"></ion-icon>
                  {{ 'GROUPS.REMOVE_MEMBERS' | appTranslate }}
                </ion-button>
              </div>

              <app-data-table
                [data]="members()"
                [columns]="memberColumns"
                [isLoading]="isLoading()"
                [localLogic]="true"
              >
                <ng-template appCellTemplate="displayName" let-row>
                  <a [routerLink]="['/clients/view', row.id]">{{ row.displayName }}</a>
                </ng-template>
                <ng-template appCellTemplate="status" let-row>
                  <app-status-badge [status]="row.status"></app-status-badge>
                </ng-template>
              </app-data-table>
            </div>
          }

          @if (activeTab() === TAB.committee) {
            <div class="tab-content">
              <div class="tab-actions">
                <ion-button
                  color="primary"
                  data-testid="group-assign-role"
                  [disabled]="isClosed() || !members().length"
                  (click)="onAssignRole()"
                  appRequiresPermission="ASSIGNROLE_GROUP"
                >
                  <ion-icon name="ribbon-outline"></ion-icon>
                  {{ 'GROUPS.ASSIGN_ROLE' | appTranslate }}
                </ion-button>
              </div>

              <app-data-table
                [data]="roles()"
                [columns]="roleColumns"
                [isLoading]="isLoading()"
                [localLogic]="true"
              >
                <ng-template appCellTemplate="roleName" let-row>
                  {{ row.role?.name || '-' }}
                </ng-template>
                <ng-template appCellTemplate="actions" let-row>
                  <ion-button
                    fill="clear"
                    color="danger"
                    [attr.data-testid]="'group-unassign-role-' + row.id"
                    [disabled]="isClosed()"
                    (click)="onUnassignRole(row)"
                    appRequiresPermission="UNASSIGNROLE_GROUP"
                    [appTooltip]="'GROUPS.UNASSIGN_ROLE' | appTranslate"
                    [attr.aria-label]="'GROUPS.UNASSIGN_ROLE' | appTranslate"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </ng-template>
              </app-data-table>
            </div>
          }

          @if (activeTab() === TAB.notes) {
            <div class="tab-content">
              <app-group-notes-list [groupId]="groupId"></app-group-notes-list>
            </div>
          }

          @if (activeTab() === TAB.accounts) {
            <div class="tab-content">
              <app-group-accounts-tab [groupId]="groupId"></app-group-accounts-tab>
            </div>
          }

          @if (activeTab() === TAB.documents) {
            <div class="tab-content">
              <app-entity-documents entityType="groups" [entityId]="groupId"></app-entity-documents>
            </div>
          }

          @if (activeTab() === TAB.customFields) {
            <div class="tab-content">
              <app-entity-datatables
                apptableName="m_group"
                [entityId]="groupId"
              ></app-entity-datatables>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .view-container {
        padding: 16px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
      }
      .identity h1 {
        margin: 0 0 8px;
        font-size: 1.5rem;
      }
      .sub {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .account-no {
        color: var(--text-muted, #6b7280);
        font-size: 0.9rem;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .content-body {
        margin-top: 16px;
      }
      .tab-content {
        padding-top: 16px;
      }
      .tab-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-bottom: 16px;
      }
      .details-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px 24px;
      }
      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .detail-item .label {
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
      .detail-item .value {
        font-size: 14px;
      }
      .load-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px 16px;
        color: var(--text-muted, #6b7280);
      }
      .load-error ion-icon {
        font-size: 40px;
      }
    `,
  ],
})
export class GroupViewComponent implements OnInit {
  private readonly groupsService = inject(GroupsService);
  private readonly httpClient = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  groupId = 0;

  readonly group = signal<GroupDetail | null>(null);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = GROUP_TAB;

  readonly activeTab = signal<GroupTab>(GROUP_TAB.general);

  /**
   * `clientMembers` rather than `activeClientMembers`.
   *
   * Both come back. Showing only the active ones hides a pending member from the very screen an
   * officer would use to chase them, and makes the member count disagree with what the platform
   * will let you disassociate.
   */
  readonly members = computed<GroupClientMember[]>(() => this.group()?.clientMembers ?? []);
  readonly roles = computed<GroupRoleAssignment[]>(() => this.group()?.groupRoles ?? []);

  readonly isPending = computed(() => this.group()?.status?.id === GROUP_STATUS.PENDING);
  readonly isActive = computed(() => this.group()?.status?.id === GROUP_STATUS.ACTIVE);
  readonly isClosed = computed(() => this.group()?.status?.id === GROUP_STATUS.CLOSED);

  memberColumns: ColumnDef[] = [
    { key: 'accountNo', label: 'COMMON.ACCOUNT_NO' },
    { key: 'displayName', label: 'COMMON.NAME' },
    { key: 'status', label: 'COMMON.STATUS' },
    { key: 'officeName', label: 'COMMON.OFFICE' },
  ];

  roleColumns: ColumnDef[] = [
    { key: 'roleName', label: 'GROUPS.ROLE' },
    { key: 'clientName', label: 'GROUPS.MEMBER' },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadGroup();
  }

  /**
   * Fetches the group with its associations.
   *
   * Issued through `HttpClient` rather than `GroupsService.getGroupsGroupId`, which takes only
   * `staffInSelectedOfficeOnly` and `roleId` — the upstream OpenAPI document does not describe
   * `associations`, so the generated client cannot send it. Plain `GET /groups/{id}` answers
   * with the summary alone, leaving the members and committee tabs empty for every group that
   * has both. `BASE_PATH` and the injected client keep the request on the configured API root
   * and through the app's interceptors, the same escape hatch `loan-documents-tab` uses.
   *
   * `BASE_PATH` stops short of the version segment — `app.config.ts` strips a trailing `/v1`
   * because the generated services prepend their own — so `/v1` belongs here.
   */
  loadGroup(): void {
    this.isLoading.set(true);
    this.httpClient
      .get<GroupDetail>(`${this.basePath}/v1/groups/${this.groupId}`, {
        params: { associations: 'all' },
      })
      .subscribe({
        next: (detail) => {
          this.group.set(detail);
          this.hasError.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  displayDate(value: number[] | undefined): string {
    return value ? formatArrayDate(value) : '-';
  }

  onBack(): void {
    void this.router.navigate(['/groups']);
  }

  // --- Lifecycle commands -------------------------------------------------------------------

  async onActivate(): Promise<void> {
    // The platform will not activate a group before the day it was submitted on.
    const result = await this.openActionDialog(
      'GROUPS.ACTIVATE',
      'activate',
      this.isoDate(this.group()?.timeline?.submittedOnDate),
    );
    if (!result) return;

    this.runCommand('activate', {
      activationDate: formatDateToFineract(new Date(result.actionDate)),
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    });
  }

  async onClose(): Promise<void> {
    // And it will not close one before the day it was activated on.
    const result = await this.openActionDialog(
      'GROUPS.CLOSE',
      'close',
      this.isoDate(this.group()?.timeline?.activatedOnDate),
    );
    if (!result) return;

    this.runCommand('close', {
      closureDate: formatDateToFineract(new Date(result.actionDate)),
      closureReasonId: result.closureReasonId,
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    });
  }

  private openActionDialog(
    title: string,
    command: GroupActionDialogData['command'],
    minDate?: string,
  ): Promise<GroupActionResult | undefined> {
    return this.dialogService.open<GroupActionResult>(GroupActionDialogComponent, {
      data: { title, command, minDate } satisfies GroupActionDialogData,
    });
  }

  /**
   * A date the platform has stamped, as the ISO `YYYY-MM-DD` the action dialog floors on.
   *
   * These arrive rendered in the tenant's timezone, which is exactly what makes them usable as
   * a floor for a picker that would otherwise only know what day it is in the browser's.
   */
  private isoDate(value: FineractDate | undefined): string | undefined {
    const iso = formatArrayDate(value);
    return iso === '-' ? undefined : iso;
  }

  // --- Staff --------------------------------------------------------------------------------

  async onAssignStaff(): Promise<void> {
    const detail = this.group();
    const result = await this.dialogService.open<GroupStaffResult>(GroupStaffDialogComponent, {
      data: {
        officeId: detail?.officeId,
        staffId: detail?.staffId,
      } satisfies GroupStaffDialogData,
    });
    if (!result) return;

    this.runCommand('assignStaff', { staffId: result.staffId });
  }

  async onUnassignStaff(): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('GROUPS.UNASSIGN_STAFF'),
      message: this.i18n.translate('GROUPS.CONFIRM_UNASSIGN_STAFF'),
    });
    if (!confirmed) return;

    // The platform wants the staff it is being asked to remove, not an empty body: it validates
    // the id against the current assignment and rejects a mismatch.
    this.runCommand('unassignStaff', { staffId: this.group()?.staffId });
  }

  // --- Membership ---------------------------------------------------------------------------

  async onAddMembers(): Promise<void> {
    const result = await this.openMembersDialog('add');
    if (!result) return;

    this.runCommand('associateClients', { clientMembers: result.clientMembers });
  }

  async onRemoveMembers(): Promise<void> {
    const result = await this.openMembersDialog('remove');
    if (!result) return;

    this.runCommand('disassociateClients', { clientMembers: result.clientMembers });
  }

  private openMembersDialog(
    mode: GroupMembersDialogData['mode'],
  ): Promise<GroupMembersResult | undefined> {
    return this.dialogService.open<GroupMembersResult>(GroupMembersDialogComponent, {
      data: {
        mode,
        officeId: this.group()?.officeId,
        members: this.members(),
      } satisfies GroupMembersDialogData,
    });
  }

  // --- Committee ----------------------------------------------------------------------------

  async onAssignRole(): Promise<void> {
    const result = await this.dialogService.open<GroupRoleResult>(GroupRoleDialogComponent, {
      data: {
        officeId: this.group()?.officeId,
        members: this.members(),
      } satisfies GroupRoleDialogData,
    });
    if (!result) return;

    // `role`, not `roleId` — see GroupRoleDialogComponent.
    this.runCommand('assignRole', { clientId: result.clientId, role: result.roleId });
  }

  async onUnassignRole(assignment: GroupRoleAssignment): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('GROUPS.UNASSIGN_ROLE'),
      message: this.i18n.translate('GROUPS.CONFIRM_UNASSIGN_ROLE'),
      destructive: true,
    });
    if (!confirmed) return;

    // `roleId` here is the id of the *assignment*, which the platform passes as a query
    // parameter rather than in the body.
    this.runCommand('unassignRole', {}, assignment.id);
  }

  // --- Command plumbing ---------------------------------------------------------------------

  /**
   * Posts a group command and reloads.
   *
   * Reloading rather than patching the local copy: a command changes more than the field it
   * names — activating stamps the activation date and flips the status, associating a client
   * changes both member lists — and a screen that guessed at those would drift from the platform
   * in ways only the next reload would reveal.
   *
   * No error toast here. `errorInterceptor` already raises one carrying the platform's own
   * `defaultUserMessage`, and that message is the useful one: closing a group with members
   * answers "Group cannot be closed because of active clients associated with it", which a
   * generic "the group could not be updated" would replace with nothing. All this handler owes
   * is clearing the pending state.
   */
  private runCommand(command: string, body: Record<string, unknown>, roleId?: number): void {
    this.isLoading.set(true);
    (
      this.groupsService.postGroupsGroupId(
        this.groupId,
        body,
        command,
        roleId,
      ) as Observable<unknown>
    ).subscribe({
      next: () => {
        void this.notifications.success(this.i18n.translate(`GROUPS.CMD_${command.toUpperCase()}`));
        this.loadGroup();
      },
      error: () => this.isLoading.set(false),
    });
  }
}
