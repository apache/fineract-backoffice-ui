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

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { HelpIconComponent } from '../../../shared';
import { LikelihoodService } from '../../../api';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

interface LikelihoodRow {
  id?: number;
  name?: string;
  code?: string;
  likelihood?: number;
  enabled?: number;
}

/**
 * Read + update view of likelihood (PPI) entries for a given PPI name. The list endpoint
 * returns a raw JSON string; updates are posted back as a JSON-string body via the put
 * endpoint (likelihoodId, ppiName, body).
 */
@Component({
  selector: 'app-likelihood',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CdkTableModule,
    HelpIconComponent,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
  ],
  template: `
    <div class="lk-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'LIKELIHOOD.TITLE' | appTranslate }}
            <app-help-icon helpTextKey="HELP.LIKELIHOOD_DESC"></app-help-icon>
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <form #lkForm="ngForm" (ngSubmit)="load()" class="lk-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'LIKELIHOOD.PPI_NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'LIKELIHOOD.PPI_NAME' | appTranslate"
                name="ppiName"
                [(ngModel)]="ppiName"
                required
              ></ion-input>
            </ion-item>
            <ion-button color="primary" type="submit" [disabled]="lkForm.invalid || isLoading()">
              {{ 'LIKELIHOOD.LOAD' | appTranslate }}
            </ion-button>
          </form>

          @if (isLoading()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else if (rows().length) {
            <table cdk-table [dataSource]="rows()" class="lk-table">
              <ng-container cdkColumnDef="name">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'LIKELIHOOD.NAME' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.name }}</td>
              </ng-container>
              <ng-container cdkColumnDef="likelihood">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'LIKELIHOOD.LIKELIHOOD' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">
                  <ion-item fill="outline" class="lk-inline">
                    <ion-input
                      type="number"
                      [name]="'likelihood-' + row.id"
                      [(ngModel)]="row.likelihood"
                    ></ion-input>
                  </ion-item>
                </td>
              </ng-container>
              <ng-container cdkColumnDef="enabled">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'LIKELIHOOD.ENABLED' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">
                  <ion-checkbox
                    [ngModel]="row.enabled === 100"
                    [name]="'enabled-' + row.id"
                    (ngModelChange)="row.enabled = $event ? 100 : 0"
                  ></ion-checkbox>
                </td>
              </ng-container>
              <ng-container cdkColumnDef="actions">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">
                  <ion-button
                    fill="clear"
                    color="primary"
                    type="button"
                    [disabled]="isSaving()"
                    (click)="onSave(row)"
                  >
                    {{ 'COMMON.SAVE' | appTranslate }}
                  </ion-button>
                </td>
              </ng-container>
              <tr cdk-header-row *cdkHeaderRowDef="columns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: columns"></tr>
            </table>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .lk-container {
        padding: 24px;
      }
      .lk-form {
        display: flex;
        align-items: baseline;
        gap: 16px;
        margin-bottom: 16px;
      }
      .lk-table {
        width: 100%;
      }
      .lk-inline {
        width: 120px;
      }
    `,
  ],
})
export class LikelihoodComponent {
  private readonly likelihoodService = inject(LikelihoodService);

  readonly columns = ['name', 'likelihood', 'enabled', 'actions'];

  ppiName = '';
  readonly rows = signal<LikelihoodRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  load(): void {
    if (!this.ppiName) return;
    this.isLoading.set(true);
    this.likelihoodService.getLikelihoodPpiName(this.ppiName).subscribe({
      next: (raw: string) => {
        this.rows.set(this.parseList(raw));
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load likelihoods', err);
        this.rows.set([]);
        this.isLoading.set(false);
      },
    });
  }

  onSave(row: LikelihoodRow): void {
    if (!row.id) return;
    this.isSaving.set(true);
    const body = JSON.stringify({ likelihood: row.likelihood, enabled: row.enabled });
    this.likelihoodService.putLikelihoodPpiNameLikelihoodId(row.id, this.ppiName, body).subscribe({
      next: () => {
        this.isSaving.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to update likelihood', err);
        this.isSaving.set(false);
      },
    });
  }

  private parseList(raw: string): LikelihoodRow[] {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? (parsed as LikelihoodRow[]) : [];
    } catch {
      return [];
    }
  }
}
