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
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ProvisioningEntriesService, ProvisioningEntryData } from '../../../api';

/**
 * Read-only list of provisioning entries. A "Create Entry" action routes to the
 * create form, which generates a new entry (optionally posting journal entries).
 */
@Component({
  selector: 'app-provisioning-entries-list',
  standalone: true,
  imports: [TranslateModule, DataTableComponent],
  template: `
    <app-data-table
      title="nav.provisioningEntries"
      helpTextKey="HELP.PROVISIONING_ENTRIES_DESC"
      createButtonLabel="PROVISIONING_ENTRIES.CREATE"
      createPermission="CREATE_PROVISIONENTRIES"
      [columns]="columns"
      [data]="entries()"
      [totalRecords]="entries().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
    </app-data-table>
  `,
})
export class ProvisioningEntriesListComponent implements OnInit {
  private readonly entriesService = inject(ProvisioningEntriesService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'PROVISIONING_ENTRIES.ID', sortable: true },
    { key: 'createdDate', label: 'PROVISIONING_ENTRIES.CREATED_DATE', sortable: true },
    { key: 'createdUser', label: 'PROVISIONING_ENTRIES.CREATED_USER', sortable: true },
    { key: 'reservedAmount', label: 'PROVISIONING_ENTRIES.RESERVED_AMOUNT', sortable: true },
  ];

  readonly entries = signal<ProvisioningEntryData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.entriesService.getProvisioningentries().subscribe({
      next: (page) => {
        this.entries.set(page?.pageItems || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load provisioning entries', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/accounting/provisioning-entries/create']);
  }
}
