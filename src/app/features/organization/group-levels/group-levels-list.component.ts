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
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { GroupsLevelService, GroupLevelData } from '../../../api';
import { IconComponent } from '../../../ui/icon/icon.component';

/**
 * Read-only listing of the configured group levels (e.g. Center, Group). Group levels
 * are static reference data, so the page only displays the hierarchy with no actions.
 */
@Component({
  selector: 'app-group-levels-list',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective, IconComponent],
  template: `
    <app-data-table
      title="nav.groupLevels"
      helpTextKey="HELP.GROUP_LEVELS_DESC"
      [hasError]="hasError()"
      [errorStatus]="errorStatus()"
      (retry)="load()"
      [columns]="columns"
      [data]="groupLevels()"
      [totalRecords]="groupLevels().length"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="canHaveClients" let-row>
        @if (row.canHaveClients) {
          <app-icon tone="success" name="checkmark-outline" />
        }
      </ng-template>
    </app-data-table>
  `,
})
export class GroupLevelsListComponent implements OnInit {
  private readonly groupsLevelService = inject(GroupsLevelService);

  readonly columns: ColumnDef[] = [
    { key: 'levelName', label: 'GROUP_LEVELS.LEVEL_NAME', sortable: true },
    { key: 'parentLevelName', label: 'GROUP_LEVELS.PARENT_LEVEL', sortable: true },
    { key: 'childLevelName', label: 'GROUP_LEVELS.CHILD_LEVEL', sortable: true },
    { key: 'canHaveClients', label: 'GROUP_LEVELS.CAN_HAVE_CLIENTS', sortable: false },
  ];

  readonly groupLevels = signal<GroupLevelData[]>([]);
  readonly hasError = signal(false);
  /**
   * The status the read failed with.
   *
   * Fineract refuses `GET /grouplevels` with a 403 for a role that may not read them, and the
   * error was swallowed into an empty list — so a user who is not allowed to see group levels
   * was told the institution has none (#751). `app-data-table` reports a 403 as a permission
   * problem and withholds the retry, which is the difference this carries.
   */
  readonly errorStatus = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.groupsLevelService.getGrouplevels().subscribe({
      next: (data: GroupLevelData[]) => {
        this.hasError.set(false);
        this.errorStatus.set(null);
        this.groupLevels.set(data || []);
      },
      error: (err: unknown) => {
        this.hasError.set(true);
        this.errorStatus.set((err as { status?: number })?.status ?? null);
        this.groupLevels.set([]);
        console.error('Failed to load group levels', err);
      },
    });
  }
}
