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
import { PovertyLineService } from '../../../api';
import { CdkTableModule } from '@angular/cdk/table';
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

interface PovertyLineRow {
  scoreFrom?: number;
  scoreTo?: number;
  povertyLine?: number;
  enabled?: boolean;
}

/**
 * Read view of the poverty-line (PPI) table for a given PPI name. The endpoint returns a
 * raw JSON string, so the body is parsed before display.
 */
@Component({
  selector: 'app-poverty-line',
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
  ],
  template: `
    <div class="pl-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'POVERTY_LINE.TITLE' | appTranslate }}
            <app-help-icon helpTextKey="HELP.POVERTY_LINE_DESC"></app-help-icon>
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <form #plForm="ngForm" (ngSubmit)="load()" class="pl-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'POVERTY_LINE.PPI_NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'POVERTY_LINE.PPI_NAME' | appTranslate"
                name="ppiName"
                [(ngModel)]="ppiName"
                required
              ></ion-input>
            </ion-item>
            <ion-button color="primary" type="submit" [disabled]="plForm.invalid || isLoading()">
              {{ 'POVERTY_LINE.LOAD' | appTranslate }}
            </ion-button>
          </form>

          @if (isLoading()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else if (rows().length) {
            <table cdk-table [dataSource]="rows()" class="pl-table">
              <ng-container cdkColumnDef="scoreFrom">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'POVERTY_LINE.SCORE_FROM' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.scoreFrom }}</td>
              </ng-container>
              <ng-container cdkColumnDef="scoreTo">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'POVERTY_LINE.SCORE_TO' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.scoreTo }}</td>
              </ng-container>
              <ng-container cdkColumnDef="povertyLine">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'POVERTY_LINE.POVERTY_LINE' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.povertyLine }}</td>
              </ng-container>
              <ng-container cdkColumnDef="enabled">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'POVERTY_LINE.ENABLED' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.enabled }}</td>
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
      .pl-container {
        padding: 24px;
      }
      .pl-form {
        display: flex;
        align-items: baseline;
        gap: 16px;
        margin-bottom: 16px;
      }
      .pl-table {
        width: 100%;
      }
    `,
  ],
})
export class PovertyLineComponent {
  private readonly povertyLineService = inject(PovertyLineService);

  readonly columns = ['scoreFrom', 'scoreTo', 'povertyLine', 'enabled'];

  ppiName = '';
  readonly rows = signal<PovertyLineRow[]>([]);
  readonly isLoading = signal(false);

  load(): void {
    if (!this.ppiName) return;
    this.isLoading.set(true);
    this.povertyLineService.getPovertyLinePpiName(this.ppiName).subscribe({
      next: (raw: string) => {
        this.rows.set(this.parseList(raw));
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load poverty line', err);
        this.rows.set([]);
        this.isLoading.set(false);
      },
    });
  }

  private parseList(raw: string): PovertyLineRow[] {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed as PovertyLineRow[];
      const obj = parsed as { povertyLineList?: PovertyLineRow[] };
      return Array.isArray(obj.povertyLineList) ? obj.povertyLineList : [];
    } catch {
      return [];
    }
  }
}
