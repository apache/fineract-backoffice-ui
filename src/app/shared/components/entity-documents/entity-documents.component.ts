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
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DocumentsService, DocumentData, BASE_PATH } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { I18N, TranslatePipe, DOWNLOAD } from '../../../core/adapters';
import { IonButton, IonIcon, IonInput, IonItem, IonLabel } from '@ionic/angular/standalone';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../directives/tooltip.directive';

/**
 * Documents attached to any Fineract record that accepts them.
 *
 * Like notes, documents live under one templated path — `/{entityType}/{entityId}/documents` — so
 * the entity is an input rather than a separate component per screen. Documents are the
 * evidentiary record behind a decision (signed application, ID proof, collateral photos), and
 * staff need to attach them without leaving the record they are reviewing.
 */
@Component({
  selector: 'app-entity-documents',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CdkTableModule,
    IonIcon,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    TooltipDirective,
  ],
  template: `
    <div class="upload-row">
      <ion-item fill="outline">
        <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
        <ion-input
          [attr.aria-label]="'COMMON.NAME' | appTranslate"
          [ngModel]="newDocName()"
          (ngModelChange)="newDocName.set($event)"
          name="docName"
        ></ion-input>
      </ion-item>
      <ion-item fill="outline" class="description-input">
        <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
        <ion-input
          [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
          [ngModel]="newDocDescription()"
          (ngModelChange)="newDocDescription.set($event)"
          name="docDescription"
        ></ion-input>
      </ion-item>
      <ion-button fill="outline" type="button" (click)="fileInput.click()">
        <ion-icon name="attach-outline"></ion-icon>
        {{ 'DOCUMENTS.SELECT_FILE' | appTranslate }}
      </ion-button>
      <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none" />
      <span class="file-name">{{
        selectedFile()?.name || ('DOCUMENTS.NO_FILE_SELECTED' | appTranslate)
      }}</span>
      <ion-button color="primary" [disabled]="!selectedFile() || isSaving()" (click)="onUpload()">
        <ion-icon name="cloud-upload-outline"></ion-icon>
        {{ 'DOCUMENTS.UPLOAD' | appTranslate }}
      </ion-button>
    </div>

    @if (isLoading()) {
      <p class="empty-state">{{ 'COMMON.LOADING' | appTranslate }}</p>
    } @else if (documents().length === 0) {
      <p class="empty-state">{{ 'DOCUMENTS.NONE' | appTranslate }}</p>
    } @else {
      <table cdk-table [dataSource]="documents()" class="full-width-table">
        <ng-container cdkColumnDef="name">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.NAME' | appTranslate }}</th>
          <td cdk-cell *cdkCellDef="let doc">{{ doc.name }}</td>
        </ng-container>
        <ng-container cdkColumnDef="fileName">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'DOCUMENTS.FILE_NAME' | appTranslate }}</th>
          <td cdk-cell *cdkCellDef="let doc">{{ doc.fileName }}</td>
        </ng-container>
        <ng-container cdkColumnDef="type">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | appTranslate }}</th>
          <td cdk-cell *cdkCellDef="let doc">{{ doc.type }}</td>
        </ng-container>
        <ng-container cdkColumnDef="actions">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
          <td cdk-cell *cdkCellDef="let doc">
            <ion-button
              fill="clear"
              color="primary"
              (click)="onDownload(doc.id)"
              [attr.aria-label]="'COMMON.DOWNLOAD' | appTranslate"
              [appTooltip]="'COMMON.DOWNLOAD' | appTranslate"
            >
              <ion-icon name="download-outline"></ion-icon>
            </ion-button>
            <ion-button
              fill="clear"
              color="danger"
              (click)="onDelete(doc.id)"
              [attr.aria-label]="'COMMON.DELETE' | appTranslate"
              [appTooltip]="'COMMON.DELETE' | appTranslate"
            >
              <ion-icon name="trash-outline"></ion-icon>
            </ion-button>
          </td>
        </ng-container>
        <tr cdk-header-row *cdkHeaderRowDef="columns"></tr>
        <tr cdk-row *cdkRowDef="let row; columns: columns"></tr>
      </table>
    }
  `,
  styles: [
    `
      .upload-row {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .description-input {
        flex: 1;
        min-width: 180px;
      }
      .file-name {
        font-size: 14px;
        color: var(--text-muted, #7f8c8d);
      }
      .full-width-table {
        width: 100%;
      }
      .empty-state {
        color: #95a5a6;
        text-align: center;
        padding: 24px;
      }
    `,
  ],
})
export class EntityDocumentsComponent implements OnInit {
  /** The path segment Fineract knows this entity by: `clients`, `groups`, `loans`, `savings`. */
  readonly entityType = input.required<string>();
  readonly entityId = input.required<number>();

  private readonly documentsService = inject(DocumentsService);
  private readonly download = inject(DOWNLOAD);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);
  private readonly httpClient = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);

  readonly documents = signal<DocumentData[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly selectedFile = signal<File | undefined>(undefined);
  readonly newDocName = signal('');
  readonly newDocDescription = signal('');

  columns = ['name', 'fileName', 'type', 'actions'];

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.isLoading.set(true);
    this.documentsService
      .getEntityTypeEntityIdDocuments(this.entityType(), this.entityId())
      .subscribe({
        next: (data) => {
          this.documents.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load documents', err);
          this.isLoading.set(false);
        },
      });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      this.selectedFile.set(file);
      if (!this.newDocName()) {
        this.newDocName.set(file.name);
      }
    }
  }

  onUpload(): void {
    // Held in a local because a signal call cannot be narrowed — the guard below would not
    // convince the compiler that the later reads are non-undefined.
    const file = this.selectedFile();
    if (!file) return;
    this.isSaving.set(true);

    // The OpenAPI-generated postEntityTypeEntityIdDocuments() has a codegen
    // bug: it computes canConsumeForm but never uses it, so it always sends
    // a plain HttpParams body instead of real multipart/form-data — Fineract
    // rejects that with 415. Post the FormData directly instead; the global
    // authInterceptor still attaches the tenant/auth headers for us.
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('name', this.newDocName() || file.name);
    if (this.newDocDescription()) {
      formData.append('description', this.newDocDescription());
    }

    this.httpClient
      .post(`${this.basePath}/v1/${this.entityType()}/${this.entityId()}/documents`, formData)
      .subscribe({
        next: () => {
          this.selectedFile.set(undefined);
          this.newDocName.set('');
          this.newDocDescription.set('');
          this.isSaving.set(false);
          this.loadDocuments();
        },
        error: (err) => {
          console.error('Failed to upload document', err);
          this.isSaving.set(false);
        },
      });
  }

  onDownload(id: number): void {
    this.documentsService
      .getEntityTypeEntityIdDocumentsDocumentIdAttachment(this.entityType(), this.entityId(), id)
      .subscribe({
        next: (blob: Blob) => {
          const doc = this.documents().find((d) => d.id === id);
          this.download.save(blob, doc?.fileName || 'document');
        },
        error: (err) => console.error('Failed to download document', err),
      });
  }

  onDelete(id: number): void {
    this.dialogService
      .confirm({
        title: this.i18n.translate('COMMON.DELETE'),
        message: this.i18n.translate('DOCUMENTS.CONFIRM_DELETE'),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.documentsService
          .deleteEntityTypeEntityIdDocumentsDocumentId(this.entityType(), this.entityId(), id)
          .subscribe({
            next: () => this.loadDocuments(),
            error: (err) => console.error('Failed to delete document', err),
          });
      });
  }
}
