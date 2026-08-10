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

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { DataTableComponent, CellTemplateDirective, ColumnDef } from '../../../shared';
import { MakerCheckerOr4EyeFunctionalityService, AuditData } from '../../../api';
import { ViewPayloadDialogComponent } from './view-payload-dialog.component';

@Component({
  selector: 'app-checker-inbox',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    DataTableComponent,
    CellTemplateDirective,
  ],
  template: `
    <app-data-table
      title="nav.checker_inbox"
      helpTextKey="HELP.TASKS_DESC"
      [columns]="columns"
      [data]="tasks"
      [showSearch]="false"
      (sortChange)="onSort()"
    >
      <ng-template appCellTemplate="madeOnDate" let-task>
        {{ formatDate(task.madeOnDate) }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-task>
        <div class="action-buttons">
          <button
            mat-icon-button
            color="primary"
            matTooltip="View Payload"
            (click)="onViewPayload(task)"
          >
            <mat-icon>visibility</mat-icon>
          </button>
          <button
            mat-icon-button
            class="approve-btn"
            matTooltip="Approve"
            (click)="onApprove(task)"
          >
            <mat-icon>check_circle</mat-icon>
          </button>
          <button mat-icon-button color="warn" matTooltip="Reject" (click)="onReject(task)">
            <mat-icon>cancel</mat-icon>
          </button>
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
  private readonly makerCheckerService = inject(MakerCheckerOr4EyeFunctionalityService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  columns: ColumnDef[] = [
    { key: 'id', label: 'COMMON.ID', sortable: true },
    { key: 'madeOnDate', label: 'COMMON.MADE_ON', sortable: true },
    { key: 'maker', label: 'COMMON.MAKER', sortable: true },
    { key: 'actionName', label: 'COMMON.ACTION', sortable: true },
    { key: 'entityName', label: 'COMMON.ENTITY', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  tasks: Record<string, unknown>[] = [];
  private refreshSubject = new Subject<void>();

  constructor() {
    this.refreshSubject
      .pipe(
        startWith({}),
        switchMap(() =>
          this.makerCheckerService.retrieveCommands().pipe(
            catchError(() => {
              this.snackBar.open('Error fetching pending tasks', 'Close', { duration: 3000 });
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
        this.tasks = data;
      });
  }

  onSort() {
    // Local sorting handled by DataTableComponent if localLogic is true
  }

  onViewPayload(task: Record<string, unknown>) {
    this.dialog.open(ViewPayloadDialogComponent, {
      width: '600px',
      data: { payload: task['commandAsJson'] as string },
    });
  }

  onApprove(task: Record<string, unknown>) {
    this.makerCheckerService.approveMakerCheckerEntry(task['id'] as number, 'approve').subscribe({
      next: () => {
        this.snackBar.open('Task approved successfully', 'Close', { duration: 3000 });
        this.refreshSubject.next();
      },
      error: () => {
        this.snackBar.open('Failed to approve task', 'Close', { duration: 3000 });
      },
    });
  }

  onReject(task: Record<string, unknown>) {
    if (confirm('Are you sure you want to reject this task?')) {
      this.makerCheckerService.postMakercheckersAuditId(task['id'] as number, 'reject').subscribe({
        next: () => {
          this.snackBar.open('Task rejected successfully', 'Close', { duration: 3000 });
          this.refreshSubject.next();
        },
        error: () => {
          this.snackBar.open('Failed to reject task', 'Close', { duration: 3000 });
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
}
