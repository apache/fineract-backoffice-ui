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
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ColumnDef, CellTemplateDirective } from '../../shared';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { CalendarService, CalendarData } from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { formatArrayDate } from '../../core/utils/date-formatter';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { DialogService } from '../../core/services/dialog.service';
import { ButtonComponent } from '../../ui/button/button.component';

/**
 * Lists the calendars (meeting schedules) attached to a single group or center.
 * The entity type ('groups' / 'centers') and entity id are read from the route
 * snapshot; create, edit and delete actions operate within that entity's collection.
 */
@Component({
  selector: 'app-calendars-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="CALENDARS.TITLE"
      helpTextKey="HELP.CALENDARS_DESC"
      createButtonLabel="CALENDARS.CREATE"
      createPermission="CREATE_CALENDAR"
      [columns]="columns"
      [data]="calendars()"
      [totalRecords]="calendars().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="startDate" let-row>
        {{ formatDate(row.startDate) }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEdit(row)"
        />
        <app-button
          type="button"
          intent="danger"
          emphasis="quiet"
          [label]="'COMMON.DELETE' | appTranslate"
          icon="trash-outline"
          [appTooltip]="'COMMON.DELETE' | appTranslate"
          (click)="onDelete(row)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class CalendarsListComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'title', label: 'CALENDARS.TITLE_FIELD', sortable: true },
    { key: 'startDate', label: 'CALENDARS.START_DATE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  entityType!: string;
  entityId!: number;
  readonly calendars = signal<CalendarData[]>([]);
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.entityType = this.route.snapshot.paramMap.get('entityType') ?? '';
    this.entityId = Number(this.route.snapshot.paramMap.get('entityId'));
    this.load();
  }

  load(): void {
    this.calendarService
      .getEntityTypeEntityIdCalendars(this.entityType, this.entityId)
      .pipe(
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of([] as CalendarData[]);
        }),
      )
      .subscribe((data: CalendarData[]) => {
        this.calendars.set(data || []);
      });
  }

  onRetry(): void {
    this.load();
  }

  formatDate(value: string | undefined): string {
    return formatArrayDate(value);
  }

  onCreate(): void {
    this.router.navigate(['/calendars', this.entityType, this.entityId, 'create']);
  }

  onEdit(row: CalendarData): void {
    this.router.navigate(['/calendars', this.entityType, this.entityId, 'edit', row.id]);
  }

  onDelete(row: CalendarData): void {
    if (!row.id) return;

    void this.dialogService
      .confirm({
        title: this.i18n.translate('CALENDARS.DELETE'),
        message: this.i18n.translate('CALENDARS.CONFIRM_DELETE', { name: row.title }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.calendarService
          .deleteEntityTypeEntityIdCalendarsCalendarId(this.entityType, this.entityId, row.id!)
          .subscribe({
            next: () => this.load(),
          });
      });
  }
}
