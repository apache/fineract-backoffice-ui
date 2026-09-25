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
import { TranslateModule } from '@ngx-translate/core';
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
  imports: [TranslateModule, DataTableComponent, CellTemplateDirective, IconComponent],
  template: `
    <app-data-table
      title="nav.groupLevels"
      helpTextKey="HELP.GROUP_LEVELS_DESC"
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

  ngOnInit(): void {
    this.groupsLevelService.getGrouplevels().subscribe({
      next: (data: GroupLevelData[]) => {
        this.groupLevels.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load group levels', err);
      },
    });
  }
}
