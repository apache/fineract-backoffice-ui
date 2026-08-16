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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DocumentsService, DocumentData, BASE_PATH } from '../../api';
import { DialogService } from '../../core/services/dialog.service';
import { IonButton, IonIcon, IonInput, IonItem, IonLabel } from '@ionic/angular/standalone';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { DOWNLOAD } from '../../core/adapters';

// Loan-level documents are the evidentiary record for underwriting/servicing
// decisions (signed application, ID proof, collateral photos) — staff need
// to attach them quickly during the same session they're reviewing the loan,
// and pull them back up later without leaving the loan account view.
@Component({
  selector: 'app-loan-documents-tab',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
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
        <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
        <ion-input
          [attr.aria-label]="'COMMON.NAME' | translate"
          [ngModel]="newDocName()"
          (ngModelChange)="newDocName.set($event)"
          name="docName"
        ></ion-input>
      </ion-item>
      <ion-item fill="outline" class="description-input">
        <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | translate }}</ion-label>
        <ion-input
          [attr.aria-label]="'COMMON.DESCRIPTION' | translate"
          [ngModel]="newDocDescription()"
          (ngModelChange)="newDocDescription.set($event)"
          name="docDescription"
        ></ion-input>
      </ion-item>
      <ion-button fill="outline" type="button" (click)="fileInput.click()">
        <ion-icon name="attach-outline"></ion-icon>
        {{ 'LOANS.SELECT_FILE' | translate }}
      </ion-button>
      <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none" />
      <span class="file-name">{{
        selectedFile()?.name || ('LOANS.NO_FILE_SELECTED' | translate)
      }}</span>
      <ion-button color="primary" [disabled]="!selectedFile() || isSaving()" (click)="onUpload()">
        <ion-icon name="cloud-upload-outline"></ion-icon>
        {{ 'LOANS.UPLOAD' | translate }}
      </ion-button>
    </div>

    @if (isLoading()) {
      <p class="empty-state">{{ 'COMMON.LOADING' | translate }}</p>
    } @else if (documents().length === 0) {
      <p class="empty-state">{{ 'LOANS.NO_DOCUMENTS' | translate }}</p>
    } @else {
      <table cdk-table [dataSource]="documents()" class="full-width-table">
        <ng-container cdkColumnDef="name">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.NAME' | translate }}</th>
          <td cdk-cell *cdkCellDef="let doc">{{ doc.name }}</td>
        </ng-container>
        <ng-container cdkColumnDef="fileName">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'LOANS.FILE_NAME' | translate }}</th>
          <td cdk-cell *cdkCellDef="let doc">{{ doc.fileName }}</td>
        </ng-container>
        <ng-container cdkColumnDef="type">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | translate }}</th>
          <td cdk-cell *cdkCellDef="let doc">{{ doc.type }}</td>
        </ng-container>
        <ng-container cdkColumnDef="actions">
          <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | translate }}</th>
          <td cdk-cell *cdkCellDef="let doc">
            <ion-button
              fill="clear"
              color="primary"
              (click)="onDownload(doc.id)"
              [attr.aria-label]="'COMMON.DOWNLOAD' | translate"
              [appTooltip]="'COMMON.DOWNLOAD' | translate"
            >
              <ion-icon name="download-outline"></ion-icon>
            </ion-button>
            <ion-button
              fill="clear"
              color="danger"
              (click)="onDelete(doc.id)"
              [attr.aria-label]="'COMMON.DELETE' | translate"
              [appTooltip]="'COMMON.DELETE' | translate"
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
export class LoanDocumentsTabComponent implements OnInit {
  readonly loanId = input.required<number>();

  private readonly documentsService = inject(DocumentsService);
  private readonly download = inject(DOWNLOAD);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);
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
    this.documentsService.getEntityTypeEntityIdDocuments('loans', this.loanId()).subscribe({
      next: (data) => {
        this.documents.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load loan documents', err);
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
      .post(`${this.basePath}/v1/loans/${this.loanId()}/documents`, formData)
      .subscribe({
        next: () => {
          this.selectedFile.set(undefined);
          this.newDocName.set('');
          this.newDocDescription.set('');
          this.isSaving.set(false);
          this.loadDocuments();
        },
        error: (err) => {
          console.error('Failed to upload loan document', err);
          this.isSaving.set(false);
        },
      });
  }

  onDownload(id: number): void {
    this.documentsService
      .getEntityTypeEntityIdDocumentsDocumentIdAttachment('loans', this.loanId(), id)
      .subscribe({
        next: (blob: Blob) => {
          const doc = this.documents().find((d) => d.id === id);
          this.download.save(blob, doc?.fileName || 'document');
        },
        error: (err) => console.error('Failed to download loan document', err),
      });
  }

  onDelete(id: number): void {
    this.dialogService
      .confirm({
        title: this.translate.instant('COMMON.DELETE'),
        message: this.translate.instant('LOANS.CONFIRM_DELETE_DOCUMENT'),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.documentsService
          .deleteEntityTypeEntityIdDocumentsDocumentId('loans', this.loanId(), id)
          .subscribe({
            next: () => this.loadDocuments(),
            error: (err) => console.error('Failed to delete loan document', err),
          });
      });
  }
}
