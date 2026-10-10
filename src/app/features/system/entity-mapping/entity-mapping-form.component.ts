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
import { FineractEntityService } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Local request/response shape for an entity-to-entity mapping. The generated service
 * exchanges raw JSON `string` bodies, so payloads are stringified / parsed through this
 * minimal interface.
 */
interface EntityMappingPayload {
  relId?: number;
  fromId?: number;
  toId?: number;
}

/** Tolerates the JSON string the generated type promises and the object the API sends. */
export function readMappingPayload(body: unknown): EntityMappingPayload {
  if (body === null || body === undefined || body === '') return {};
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body;
  return (parsed ?? {}) as EntityMappingPayload;
}

/**
 * Create / edit form for an entity-to-entity mapping. The relationship id selects which
 * mapping type is created; from/to ids identify the linked entities.
 */
@Component({
  selector: 'app-entity-mapping-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
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
              isEditMode()
                ? ('ENTITY_MAPPING.EDIT' | appTranslate)
                : ('ENTITY_MAPPING.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #mappingForm="ngForm" (ngSubmit)="onSubmit()" class="entity-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'ENTITY_MAPPING.REL_ID' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'ENTITY_MAPPING.REL_ID' | appTranslate"
                type="number"
                name="relId"
                [ngModel]="relId()"
                (ngModelChange)="relId.set($event)"
                required
                [disabled]="isEditMode()"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ENTITY_MAPPING.FROM_ID' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'ENTITY_MAPPING.FROM_ID' | appTranslate"
                type="number"
                name="fromId"
                [(ngModel)]="payload().fromId"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'ENTITY_MAPPING.TO_ID' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'ENTITY_MAPPING.TO_ID' | appTranslate"
                type="number"
                name="toId"
                [(ngModel)]="payload().toId"
                required
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="mappingForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
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
      .entity-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class EntityMappingFormComponent implements OnInit {
  private readonly entityService = inject(FineractEntityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/entity-mapping';

  mapId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly relId = signal<number | undefined>(undefined);
  readonly payload = signal<EntityMappingPayload>({});

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.mapId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.mapId) return;
    this.entityService.getEntitytoentitymappingMapId(this.mapId).subscribe({
      // Typed `string` by the generator, but `HttpClient` has already deserialised the JSON —
      // parsing it again throws on the object it actually receives. See issue #611.
      next: (body: unknown) => {
        const data = readMappingPayload(body);
        this.payload.set({ fromId: data.fromId, toId: data.toId });
        this.relId.set(data.relId);
      },
      error: (err: unknown) => {
        console.error('Failed to load entity mapping', err);
      },
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const body = JSON.stringify({ fromId: this.payload().fromId, toId: this.payload().toId });
    const request$ =
      this.isEditMode() && this.mapId
        ? this.entityService.putEntitytoentitymappingMapId(this.mapId, body)
        : this.entityService.postEntitytoentitymappingRelId(this.relId() ?? 0, body);

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
