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

import { Component, inject, signal } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import { DataTableComponent, CellTemplateDirective, ColumnDef } from '../../../shared';
import { MakerCheckerOr4EyeFunctionalityService, AuditData } from '../../../api';
import { ViewPayloadDialogComponent } from './view-payload-dialog.component';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { NotificationService } from '../../../core/services/notification.service';
import { DialogService } from '../../../core/services/dialog.service';

@Component({
  selector: 'app-checker-inbox',
  standalone: true,
  imports: [TranslateModule, DataTableComponent, CellTemplateDirective, IonIcon, IonButton],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.checker_inbox"
      helpTextKey="HELP.TASKS_DESC"
      [columns]="columns"
      [data]="tasks()"
      [showSearch]="false"
      (sortChange)="onSort()"
    >
      <ng-template appCellTemplate="madeOnDate" let-task>
        {{ formatDate(task.madeOnDate) }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-task>
        <div class="action-buttons">
          <ion-button
            fill="clear"
            color="primary"
            (click)="onViewPayload(task)"
            [attr.aria-label]="'CHECKER_INBOX.VIEW_PAYLOAD' | translate"
          >
            <ion-icon name="eye-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            class="approve-btn"
            (click)="onApprove(task)"
            [attr.aria-label]="'ACTIONS.APPROVE' | translate"
          >
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            color="danger"
            (click)="onReject(task)"
            [attr.aria-label]="'ACTIONS.REJECT' | translate"
          >
            <ion-icon name="close-circle-outline"></ion-icon>
          </ion-button>
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .action-buttons {
        display: flex;
        gap: 4px;
      }
      .approve-btn {
        color: #2ecc71;
      }
    `,
  ],
})
export class CheckerInboxComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  private readonly makerCheckerService = inject(MakerCheckerOr4EyeFunctionalityService);
  private readonly notifications = inject(NotificationService);
  private readonly dialogService = inject(DialogService);

  columns: ColumnDef[] = [
    { key: 'id', label: 'COMMON.ID', sortable: true },
    { key: 'madeOnDate', label: 'COMMON.MADE_ON', sortable: true },
    { key: 'maker', label: 'COMMON.MAKER', sortable: true },
    { key: 'actionName', label: 'COMMON.ACTION', sortable: true },
    { key: 'entityName', label: 'COMMON.ENTITY', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly tasks = signal<Record<string, unknown>[]>([]);
  private refreshSubject = new Subject<void>();

  constructor() {
    this.refreshSubject
      .pipe(
        startWith({}),
        switchMap(() =>
          this.makerCheckerService.getMakercheckers().pipe(
            tap(() => this.hasError.set(false)),
            // Reported in the table itself rather than as a toast: the failure is about
            // this list, and the retry belongs next to the empty space it explains.
            catchError(() => {
              this.hasError.set(true);
              return of([]);
            }),
          ),
        ),
        map((data: AuditData[]) => {
          // Type casting to access undocumented fields returned by Fineract API
          return ((data as unknown as Record<string, unknown>[]) || []).map((item) => ({
            ...item,
            // Extract displayable values if they are nested objects
            maker: item['maker'] || item['createdByUsername'],
          }));
        }),
      )
      .subscribe((data) => {
        this.tasks.set(data);
      });
  }

  onSort() {
    // Local sorting handled by DataTableComponent if localLogic is true
  }

  onViewPayload(task: Record<string, unknown>): Promise<void> {
    return this.dialogService
      .open(ViewPayloadDialogComponent, { data: { payload: task['commandAsJson'] as string } })
      .then(() => undefined);
  }

  onApprove(task: Record<string, unknown>) {
    this.makerCheckerService.postMakercheckersAuditId(task['id'] as number, 'approve').subscribe({
      next: () => {
        this.notifications.success('Task approved successfully');
        this.refreshSubject.next();
      },
      error: () => {
        this.notifications.error('Failed to approve task');
      },
    });
  }

  onReject(task: Record<string, unknown>) {
    if (confirm('Are you sure you want to reject this task?')) {
      this.makerCheckerService.deleteMakercheckersAuditId(task['id'] as number).subscribe({
        next: () => {
          this.notifications.success('Task rejected successfully');
          this.refreshSubject.next();
        },
        error: () => {
          this.notifications.error('Failed to reject task');
        },
      });
    }
  }

  formatDate(dateArray: unknown): string {
    if (Array.isArray(dateArray)) {
      return new Date(dateArray[0], dateArray[1] - 1, dateArray[2]).toLocaleDateString();
    }
    return (dateArray as string) || '';
  }
  onRetry(): void {
    this.refreshSubject.next();
  }
}
