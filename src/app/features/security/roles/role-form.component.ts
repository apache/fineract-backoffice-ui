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
import { TranslateModule } from '@ngx-translate/core';
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
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  RolesService,
  PostRolesRequest,
  PutRolesRoleIdRequest,
  PutRolesRoleIdPermissionsRequest,
  GetRolesRoleIdPermissionsResponse,
} from '../../../api';

/**
 * Component for creating and editing system roles and their permissions.
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode() ? ('ROLES.EDIT_ROLE' | translate) : ('ROLES.CREATE_ROLE' | translate) }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #roleForm="ngForm" (ngSubmit)="onSubmit()" class="role-form">
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'COMMON.NAME' | translate"
                name="name"
                [(ngModel)]="role().name"
                required
                [disabled]="isEditMode()"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | translate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'COMMON.DESCRIPTION' | translate"
                name="description"
                [(ngModel)]="role().description"
                required
                rows="2"
              ></ion-textarea>
            </ion-item>

            @if (isEditMode()) {
              <hr class="divider" />
              <div class="permissions-section">
                <h3>{{ 'ROLES.PERMISSIONS' | translate }}</h3>

                <div class="matrix-container">
                  @for (group of groupedPermissions(); track group.prefix) {
                    <div class="permission-group">
                      <div class="group-header">
                        <strong>{{ group.prefix }}</strong>
                        <div class="group-actions">
                          <ion-button fill="clear" type="button" (click)="toggleGroup(group, true)">
                            Check All
                          </ion-button>
                          <ion-button
                            fill="clear"
                            type="button"
                            (click)="toggleGroup(group, false)"
                          >
                            Uncheck All
                          </ion-button>
                        </div>
                      </div>
                      <div class="group-items">
                        @for (perm of group.items; track perm['code']) {
                          <div class="permission-item">
                            <ion-checkbox
                              [name]="'perm_' + perm['code']"
                              [(ngModel)]="permissionMappings[perm['code'] + '']"
                            >
                              {{ perm['code'] }}
                            </ion-checkbox>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="roleForm.invalid || isSaving()">
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | translate }}
                } @else {
                  {{ 'COMMON.SAVE' | translate }}
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
        max-width: 1000px;
        margin: 0 auto;
      }
      .role-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .full-width {
        width: 100%;
      }
      .permissions-section {
        margin-top: 16px;
      }
      .matrix-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-height: 600px;
        overflow-y: auto;
        padding: 16px;
        border: 1px solid #eee;
        border-radius: 4px;
      }
      .permission-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-bottom: 1px dashed #eee;
        padding-bottom: 16px;
      }
      .permission-group:last-child {
        border-bottom: none;
      }
      .group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8f9fa;
        padding: 4px 12px;
        border-radius: 4px;
      }
      .group-actions {
        display: flex;
        gap: 8px;
      }
      .group-actions button {
        font-size: 11px;
        height: 24px;
        line-height: 24px;
        padding: 0 8px;
      }
      .group-items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 8px;
        padding: 0 12px;
      }
    `,
  ],
})
export class RoleFormComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly LIST_PATH = '/security/roles';

  roleId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly role = signal<PostRolesRequest>({});
  readonly permissions = signal<Record<string, unknown>[]>([]);
  permissionMappings: Record<string, boolean> = {};

  readonly groupedPermissions = signal<{ prefix: string; items: Record<string, unknown>[] }[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.roleId = +id;
        this.isEditMode.set(true);
        this.loadRoleData();
      }
    });
  }

  private loadRoleData(): void {
    if (!this.roleId) return;
    this.rolesService.getRolesRoleId(this.roleId).subscribe((data) => {
      this.role.set({
        name: data.name,
        description: data.description,
      });
      this.loadPermissions();
    });
  }

  private loadPermissions(): void {
    if (!this.roleId) return;
    this.rolesService
      .getRolesRoleIdPermissions(this.roleId)
      .subscribe((data: GetRolesRoleIdPermissionsResponse) => {
        this.permissions.set(
          (data.permissionUsageData as unknown as Record<string, unknown>[]) || [],
        );
        this.permissions().forEach((p) => {
          this.permissionMappings[p['code'] + ''] = (p['selected'] as boolean) || false;
        });
        this.groupPermissions();
      });
  }

  private groupPermissions(): void {
    const groups: Record<string, Record<string, unknown>[]> = {};
    this.permissions().forEach((p) => {
      const code = p['code'] as string;
      const prefix = code.split('_', 2)[1] || 'GENERAL';
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(p);
    });

    const sortedGroups = Object.keys(groups)
      .sort()
      .map((prefix) => ({
        prefix,
        items: groups[prefix],
      }));

    this.groupedPermissions.set(sortedGroups);
  }

  toggleGroup(group: { items: Record<string, unknown>[] }, value: boolean): void {
    group.items.forEach((p) => {
      this.permissionMappings[p['code'] + ''] = value;
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.isEditMode() && this.roleId) {
      const roleUpdate: PutRolesRoleIdRequest = {
        description: this.role().description,
      };

      // Update role description
      this.rolesService.putRolesRoleId(this.roleId, roleUpdate).subscribe({
        next: () => {
          // Then update permissions
          const permUpdate: PutRolesRoleIdPermissionsRequest = {
            permissions: this.permissionMappings,
          };
          this.rolesService.putRolesRoleIdPermissions(this.roleId!, permUpdate).subscribe({
            next: () => this.router.navigate([this.LIST_PATH]),
            error: () => this.isSaving.set(false),
          });
        },
        error: () => this.isSaving.set(false),
      });
    } else {
      this.rolesService.postRoles(this.role()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
