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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { PermissionsService, GetPermissionsResponse, PutPermissionsRequest } from '../../../api';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
} from '@ionic/angular/standalone';

/**
 * Maker-checker permission configuration: lists permissions grouped by their
 * `grouping`, lets the user toggle maker-checker (`selected`) per permission,
 * and saves the changed flags via putPermissions.
 */
@Component({
  selector: 'app-permissions-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CdkTableModule,
    IonButton,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
  ],
  template: `
    <div class="permissions-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'PERMISSIONS.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          @for (group of groupNames(); track group) {
            <h3 class="group-heading">{{ group }}</h3>
            <table cdk-table [dataSource]="grouped()[group]" class="permissions-table">
              <ng-container cdkColumnDef="code">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'PERMISSIONS.CODE' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.code }}</td>
              </ng-container>
              <ng-container cdkColumnDef="entityName">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'PERMISSIONS.ENTITY' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.entityName }}</td>
              </ng-container>
              <ng-container cdkColumnDef="actionName">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'PERMISSIONS.ACTION' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.actionName }}</td>
              </ng-container>
              <ng-container cdkColumnDef="selected">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'PERMISSIONS.MAKER_CHECKER' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">
                  <ion-checkbox
                    [(ngModel)]="row.selected"
                    (ngModelChange)="onToggle(row)"
                  ></ion-checkbox>
                </td>
              </ng-container>
              <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
          <div class="actions">
            <ion-button color="primary" [disabled]="isSaving()" (click)="onSave()">
              {{ 'COMMON.SAVE' | appTranslate }}
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .permissions-container {
        padding: 16px;
      }
      .group-heading {
        margin-top: 24px;
        text-transform: capitalize;
      }
      .permissions-table {
        width: 100%;
      }
      .actions {
        margin-top: 24px;
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class PermissionsListComponent implements OnInit {
  private readonly permissionsService = inject(PermissionsService);

  readonly displayedColumns = ['code', 'entityName', 'actionName', 'selected'];

  readonly permissions = signal<GetPermissionsResponse[]>([]);
  readonly grouped = signal<Record<string, GetPermissionsResponse[]>>({});
  readonly groupNames = signal<string[]>([]);
  changed: Record<string, boolean> = {};
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.permissionsService.getPermissions().subscribe({
      next: (data: GetPermissionsResponse[]) => {
        this.permissions.set(data || []);
        this.grouped.set({});
        for (const p of this.permissions()) {
          const key = p.grouping || 'other';
          if (!this.grouped()[key]) this.grouped()[key] = [];
          this.grouped()[key].push(p);
        }
        this.groupNames.set(Object.keys(this.grouped()));
        this.changed = {};
      },
      error: (err: unknown) => console.error('Failed to load permissions', err),
    });
  }

  onToggle(row: GetPermissionsResponse): void {
    if (row.code) {
      this.changed[row.code] = !!row.selected;
    }
  }

  onSave(): void {
    this.isSaving.set(true);
    const request: PutPermissionsRequest = { permissions: this.changed };
    this.permissionsService.putPermissions(request).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        console.error('Failed to save permissions', err);
      },
    });
  }
}
