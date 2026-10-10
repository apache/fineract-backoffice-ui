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
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective, LoadErrorComponent } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { FineractEntityService } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Local view of an entity-to-entity mapping row.
 *
 * The generated service declares `Observable<string>` because the spec types this response as a
 * string, but the request is sent with `Accept: application/json` and `HttpClient` deserialises
 * it, so what arrives is an array. `JSON.parse` on that stringifies to `"[object Object]"` and
 * throws — inside `next`, where the `error` callback cannot see it — see issue #611.
 */
interface EntityToEntityMapping {
  id?: number;
  relId?: number;
  fromId?: number;
  toId?: number;
  fromEnumOptionData?: { name?: string };
  toEnumOptionData?: { name?: string };
}

/**
 * Normalises whatever the endpoint hands back into rows.
 *
 * Accepts the array it returns today, the JSON string the generated type still promises, and a
 * paged envelope, because the three have each been the live shape of a Fineract list endpoint.
 * Anything else throws, so the caller can show a failure rather than an empty table.
 */
export function readMappings(body: unknown): EntityToEntityMapping[] {
  if (body === null || body === undefined || body === '') return [];
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body;
  if (Array.isArray(parsed)) return parsed as EntityToEntityMapping[];
  const pageItems = (parsed as { pageItems?: unknown })?.pageItems;
  if (Array.isArray(pageItems)) return pageItems as EntityToEntityMapping[];
  throw new TypeError(`Unexpected entity mapping payload: ${typeof parsed}`);
}

/**
 * Lists configured entity-to-entity mappings (e.g. office-to-loan-product access mappings).
 */
@Component({
  selector: 'app-entity-mapping-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
    LoadErrorComponent,
  ],
  template: `
    @if (loadFailed()) {
      <app-load-error
        testId="entity-mapping-load-error"
        [message]="'ENTITY_MAPPING.LOAD_FAILED' | appTranslate"
        [actionLabel]="'COMMON.RETRY' | appTranslate"
        (action)="load()"
      ></app-load-error>
    } @else {
      <app-data-table
        title="nav.entityMapping"
        helpTextKey="HELP.ENTITY_MAPPING_DESC"
        createButtonLabel="ENTITY_MAPPING.CREATE"
        createPermission="CREATE_ENTITYMAPPING"
        [columns]="columns"
        [data]="mappings()"
        [totalRecords]="mappings().length"
        [localLogic]="true"
        (create)="onCreate()"
      >
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
    }
  `,
})
export class EntityMappingListComponent implements OnInit {
  private readonly entityService = inject(FineractEntityService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'ENTITY_MAPPING.ID', sortable: true },
    { key: 'fromId', label: 'ENTITY_MAPPING.FROM_ID', sortable: true },
    { key: 'toId', label: 'ENTITY_MAPPING.TO_ID', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly mappings = signal<EntityToEntityMapping[]>([]);
  /** True once a load has failed, so the screen can say so instead of reading as empty. */
  readonly loadFailed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.entityService.getEntitytoentitymapping().subscribe({
      next: (body: unknown) => {
        try {
          this.mappings.set(readMappings(body));
          this.loadFailed.set(false);
        } catch (err: unknown) {
          // A throw here happens after a 2xx, so `error` below never runs. Without this the
          // screen would paint an empty table and claim there are no records.
          console.error('Failed to read entity mappings', err);
          this.mappings.set([]);
          this.loadFailed.set(true);
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load entity mappings', err);
        this.mappings.set([]);
        this.loadFailed.set(true);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/system/entity-mapping/create']);
  }

  onEdit(row: EntityToEntityMapping): void {
    this.router.navigate(['/system/entity-mapping/edit', row.id]);
  }

  async onDelete(row: EntityToEntityMapping): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('ENTITY_MAPPING.DELETE'),
      message: this.i18n.translate('ENTITY_MAPPING.CONFIRM_DELETE', {
        id: row.id,
        fromId: row.fromId ?? '',
        toId: row.toId ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.entityService.deleteEntitytoentitymappingMapId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete entity mapping', err),
    });
  }
}
