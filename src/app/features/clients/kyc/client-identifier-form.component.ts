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
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonButton,
} from '@ionic/angular/standalone';
import { ClientIdentifierService, ClientIdentifierRequest, CodeValueData } from '../../../api';

@Component({
  selector: 'app-client-identifier-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode
                ? ('CLIENTS.EDIT_IDENTIFIER' | appTranslate)
                : ('CLIENTS.ADD_IDENTIFIER' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #identifierForm="ngForm" (ngSubmit)="onSubmit()" class="identifier-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CLIENTS.DOCUMENT_TYPE' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'CLIENTS.DOCUMENT_TYPE' | appTranslate"
                interface="popover"
                name="documentTypeId"
                [(ngModel)]="identifier().documentTypeId"
                required
                id="identifier-document-type-select"
                data-testid="identifier-document-type-select"
              >
                @for (type of documentTypes(); track type.id) {
                  <ion-select-option [value]="type.id">{{ type.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CLIENTS.DOCUMENT_KEY' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'CLIENTS.DOCUMENT_KEY' | appTranslate"
                type="text"
                name="documentKey"
                [(ngModel)]="identifier().documentKey"
                required
                id="identifier-document-key-input"
                data-testid="identifier-document-key-input"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'COMMON.STATUS' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'COMMON.STATUS' | appTranslate"
                interface="popover"
                name="status"
                [(ngModel)]="identifier().status"
                id="identifier-status-select"
                data-testid="identifier-status-select"
              >
                <ion-select-option value="Active">Active</ion-select-option>
                <ion-select-option value="Inactive">Inactive</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="identifier().description"
                rows="3"
                id="identifier-description-textarea"
                data-testid="identifier-description-textarea"
              ></ion-textarea>
            </ion-item>

            <div class="form-actions">
              <ion-button
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                id="identifier-cancel-btn"
                data-testid="identifier-cancel-btn"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="!identifierForm.form.valid"
                id="identifier-submit-btn"
                data-testid="identifier-submit-btn"
              >
                {{ 'COMMON.SAVE' | appTranslate }}
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
})
export class ClientIdentifierFormComponent implements OnInit {
  private readonly identifierService = inject(ClientIdentifierService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly clientViewPath = '/clients/view';

  clientId!: number;
  identifierId?: number;
  isEditMode = false;
  readonly documentTypes = signal<CodeValueData[]>([]);

  readonly identifier = signal<ClientIdentifierRequest>({
    documentTypeId: undefined,
    documentKey: '',
    description: '',
    status: 'Active',
  });

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    this.identifierId = Number(this.route.snapshot.paramMap.get('id'));

    this.loadTemplate();

    if (this.identifierId) {
      this.isEditMode = true;
      this.loadIdentifierData();
    }
  }

  loadTemplate(): void {
    this.identifierService
      .getClientsClientIdIdentifiersTemplate(this.clientId)
      .subscribe((data) => {
        this.documentTypes.set(data.allowedDocumentTypes || []);
      });
  }

  loadIdentifierData(): void {
    this.identifierService
      .getClientsClientIdIdentifiersIdentifierId(this.clientId, this.identifierId!)
      .subscribe((data) => {
        this.identifier.set({
          documentTypeId: data.documentType?.id,
          documentKey: data.documentKey,
          description: data.description,
          status: (data as Record<string, unknown>)['status'] as string,
        });
      });
  }

  onSubmit(): void {
    if (this.isEditMode) {
      this.identifierService
        .putClientsClientIdIdentifiersIdentifierId(
          this.clientId,
          this.identifierId!,
          this.identifier(),
        )
        .subscribe({
          next: () => this.router.navigate([this.clientViewPath, this.clientId]),
          error: (err) => console.error('Failed to update identifier', err),
        });
    } else {
      this.identifierService
        .postClientsClientIdIdentifiers(this.clientId, this.identifier())
        .subscribe({
          next: () => this.router.navigate([this.clientViewPath, this.clientId]),
          error: (err) => console.error('Failed to create identifier', err),
        });
    }
  }

  onCancel(): void {
    this.router.navigate([this.clientViewPath, this.clientId]);
  }
}
