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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { DocumentsService } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-client-document-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonIcon,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode
                ? ('CLIENTS.EDIT_DOCUMENT' | appTranslate)
                : ('CLIENTS.ADD_DOCUMENT' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #docForm="ngForm" (ngSubmit)="onSubmit()" class="doc-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'COMMON.NAME' | appTranslate"
                name="name"
                [(ngModel)]="document().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="document().description"
                rows="3"
              ></ion-textarea>
            </ion-item>

            @if (!isEditMode) {
              <div class="file-input-container">
                <ion-button fill="outline" type="button" (click)="fileInput.click()">
                  <ion-icon name="attach-outline"></ion-icon>
                  {{ 'CLIENTS.SELECT_FILE' | appTranslate }}
                </ion-button>
                <input
                  #fileInput
                  type="file"
                  (change)="onFileSelected($event)"
                  style="display: none"
                  required
                />
                <span class="file-name">{{
                  selectedFile?.name || ('CLIENTS.NO_FILE_SELECTED' | appTranslate)
                }}</span>
              </div>
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="!docForm.form.valid || (!isEditMode && !selectedFile)"
              >
                {{ 'COMMON.SAVE' | appTranslate }}
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      }
      .doc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      }
      .file-input-container {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .file-name {
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class ClientDocumentFormComponent implements OnInit {
  private readonly documentService = inject(DocumentsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly clientViewPath = '/clients/view';

  clientId!: number;
  docId?: number;
  isEditMode = false;
  selectedFile?: File;

  readonly document = signal({
    name: '',
    description: '',
  });

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    this.docId = Number(this.route.snapshot.paramMap.get('id'));

    if (this.docId) {
      this.isEditMode = true;
      this.loadDocumentData();
    }
  }

  loadDocumentData(): void {
    this.documentService
      .getEntityTypeEntityIdDocumentsDocumentId('clients', this.clientId, this.docId!)
      .subscribe((data) => {
        this.document.set({
          name: data.name || '',
          description: data.description || '',
        });
      });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedFile = target.files[0];
    }
  }

  onSubmit(): void {
    if (this.isEditMode) {
      this.documentService
        .putEntityTypeEntityIdDocumentsDocumentId(
          'clients',
          this.clientId,
          this.docId!,
          undefined, // contentLength
          this.document().description,
          undefined, // expiryDate
          undefined, // file
          undefined, // issuanceDate
          this.document().name,
        )
        .subscribe({
          next: () => this.router.navigate([this.clientViewPath, this.clientId]),
          error: (err) => console.error('Failed to update document', err),
        });
    } else {
      this.documentService
        .postEntityTypeEntityIdDocuments(
          'clients',
          this.clientId,
          this.selectedFile!.size,
          this.document().description,
          undefined, // expiryDate
          this.selectedFile!,
          undefined, // issuanceDate
          this.document().name,
        )
        .subscribe({
          next: () => this.router.navigate([this.clientViewPath, this.clientId]),
          error: (err) => console.error('Failed to add document', err),
        });
    }
  }

  onCancel(): void {
    this.router.navigate([this.clientViewPath, this.clientId]);
  }
}
