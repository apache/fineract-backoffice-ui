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

import { inject, input, signal, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { DocumentsService, DocumentData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DOWNLOAD } from '../../../core/adapters';

@Component({
  selector: 'app-client-documents-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <div class="tab-actions">
      <ion-button
        color="primary"
        [routerLink]="['/clients', clientId(), 'documents', 'create']"
        *appHasPermission="'CREATE_DOCUMENT'"
      >
        <ion-icon name="cloud-upload-outline"></ion-icon>
        {{ 'CLIENTS.ADD_DOCUMENT' | translate }}
      </ion-button>
    </div>

    <app-data-table
      [data]="documents()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <ion-button
            fill="clear"
            color="primary"
            (click)="onDownload(row.id)"
            *appHasPermission="'READ_DOCUMENT'"
            [attr.aria-label]="'COMMON.DOWNLOAD' | translate"
            [appTooltip]="'COMMON.DOWNLOAD' | translate"
          >
            <ion-icon name="download-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            color="danger"
            (click)="onDelete(row.id)"
            *appHasPermission="'DELETE_DOCUMENT'"
            [attr.aria-label]="'COMMON.DELETE' | translate"
            [appTooltip]="'COMMON.DELETE' | translate"
          >
            <ion-icon name="trash-outline"></ion-icon>
          </ion-button>
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .tab-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
      }
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class ClientDocumentsListComponent implements OnInit {
  readonly clientId = input.required<number>();

  private readonly documentService = inject(DocumentsService);
  private readonly download = inject(DOWNLOAD);

  readonly documents = signal<DocumentData[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'name',
      label: 'COMMON.NAME',
    },
    {
      key: 'fileName',
      label: 'CLIENTS.FILE_NAME',
    },
    {
      key: 'type',
      label: 'COMMON.TYPE',
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.isLoading.set(true);
    this.documentService.getEntityTypeEntityIdDocuments('clients', this.clientId()).subscribe({
      next: (data) => {
        this.documents.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load client documents', err);
        this.isLoading.set(false);
      },
    });
  }

  onDownload(id: number): void {
    this.documentService
      .getEntityTypeEntityIdDocumentsDocumentIdAttachment('clients', this.clientId(), id)
      .subscribe({
        next: (blob) => {
          const doc = this.documents().find((d) => d.id === id);
          this.download.save(blob, doc?.fileName || 'document');
        },
        error: (err) => console.error('Failed to download document', err),
      });
  }

  onDelete(id: number): void {
    if (confirm('Are you sure you want to delete this document?')) {
      this.documentService
        .deleteEntityTypeEntityIdDocumentsDocumentId('clients', this.clientId(), id)
        .subscribe({
          next: () => this.loadDocuments(),
          error: (err) => console.error('Failed to delete document', err),
        });
    }
  }
}
