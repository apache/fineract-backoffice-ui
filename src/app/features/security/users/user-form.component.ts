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
import { TranslatePipe, USER_API } from '../../../core/adapters';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import type { NamedOption } from '../../../core/adapters';

/**
 * What the form holds while it is being filled.
 *
 * Its own shape rather than `UserDraft`: the draft is what a *valid* submission looks like, and
 * a form in progress has an empty office and, on the edit path, no password at all. Keeping
 * them separate is what lets `UserDraft` declare `officeId: number` instead of
 * `number | null | undefined` and have that mean something.
 */
interface UserFormModel {
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  officeId: number | null;
  roles: number[];
  password: string;
  repeatPassword: string;
  passwordNeverExpires: boolean;
  sendPasswordToEmail: boolean;
}

/**
 * Component for creating and editing system users.
 */
@Component({
  selector: 'app-user-form',
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
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('USERS.EDIT_USER' | appTranslate)
                : ('USERS.CREATE_USER' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #userForm="ngForm" (ngSubmit)="onSubmit()" class="user-form">
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'USERS.USERNAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'USERS.USERNAME' | appTranslate"
                  name="username"
                  [(ngModel)]="user().username"
                  required
                  [disabled]="isEditMode()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.FIRST_NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.FIRST_NAME' | appTranslate"
                  name="firstname"
                  [(ngModel)]="user().firstname"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.LAST_NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.LAST_NAME' | appTranslate"
                  name="lastname"
                  [(ngModel)]="user().lastname"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.EMAIL' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.EMAIL' | appTranslate"
                  type="email"
                  name="email"
                  [(ngModel)]="user().email"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.OFFICE' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                  interface="popover"
                  name="officeId"
                  [(ngModel)]="user().officeId"
                  required
                >
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              @if (!isEditMode()) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'USERS.PASSWORD' | appTranslate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'USERS.PASSWORD' | appTranslate"
                    type="password"
                    name="password"
                    [(ngModel)]="user().password"
                    required
                  ></ion-input>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'USERS.REPEAT_PASSWORD' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'USERS.REPEAT_PASSWORD' | appTranslate"
                    type="password"
                    name="repeatPassword"
                    [(ngModel)]="user().repeatPassword"
                    required
                  ></ion-input>
                </ion-item>
              }

              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{ 'USERS.ROLES' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'USERS.ROLES' | appTranslate"
                  interface="popover"
                  name="roles"
                  [(ngModel)]="user().roles"
                  multiple
                  required
                >
                  @for (role of availableRoles(); track role.id) {
                    <ion-select-option [value]="role.id">{{ role.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            </div>

            <div class="checkbox-container" style="display: flex; gap: 16px; flex-wrap: wrap;">
              <ion-checkbox name="passwordNeverExpires" [(ngModel)]="user().passwordNeverExpires">
                {{ 'USERS.PASSWORD_NEVER_EXPIRES' | appTranslate }}
              </ion-checkbox>

              <ion-checkbox name="sendPasswordToEmail" [(ngModel)]="user().sendPasswordToEmail">
                {{ 'USERS.SEND_PASSWORD_TO_EMAIL' | appTranslate }}
              </ion-checkbox>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="userForm.invalid || isSaving()">
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
        max-width: 900px;
        margin: 0 auto;
      }
      .user-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .checkbox-container {
        padding: 8px 0;
      }
    `,
  ],
})
export class UserFormComponent implements OnInit {
  private readonly userApi = inject(USER_API);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly LIST_PATH = '/security/users';

  userId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly user = signal<UserFormModel>({
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    officeId: null,
    roles: [],
    password: '',
    repeatPassword: '',
    passwordNeverExpires: false,
    sendPasswordToEmail: false,
  });

  readonly offices = signal<NamedOption[]>([]);
  readonly availableRoles = signal<NamedOption[]>([]);

  ngOnInit(): void {
    this.loadMetadata();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.userId = +id;
        this.isEditMode.set(true);
        this.loadUserData();
      }
    });
  }

  private loadMetadata(): void {
    this.userApi.template().subscribe((template) => {
      this.offices.set([...template.offices]);
      this.availableRoles.set([...template.roles]);
    });
  }

  private loadUserData(): void {
    if (!this.userId) return;
    this.userApi.get(this.userId).subscribe((member) => {
      this.user.set({
        username: member.username,
        firstname: member.firstname,
        lastname: member.lastname,
        email: member.email,
        officeId: member.officeId,
        roles: [...member.roleIds],
        // Never prefilled: the create path's two password fields are not rendered in edit mode,
        // and Fineract changes a password through its own endpoint.
        password: '',
        repeatPassword: '',
        passwordNeverExpires: member.passwordNeverExpires,
        sendPasswordToEmail: false,
      });
    });
  }

  onSubmit(): void {
    const form = this.user();
    // The Office select is `required`, so the submit button is disabled until it is set and
    // this cannot normally be reached. Checked anyway rather than coerced: `officeId: 0` is a
    // valid-looking id that belongs to no office, and Fineract would answer a 404 naming a
    // field the user did believe they had filled in.
    if (form.officeId === null) return;

    this.isSaving.set(true);
    const done = {
      next: (): void => {
        void this.router.navigate([this.LIST_PATH]);
      },
      error: (): void => this.isSaving.set(false),
    };

    if (this.isEditMode() && this.userId) {
      this.userApi
        .update(this.userId, {
          firstname: form.firstname,
          lastname: form.lastname,
          email: form.email,
          officeId: form.officeId,
          roleIds: form.roles,
          sendPasswordToEmail: form.sendPasswordToEmail,
        })
        .subscribe(done);
    } else {
      this.userApi
        .create({
          username: form.username,
          firstname: form.firstname,
          lastname: form.lastname,
          email: form.email,
          officeId: form.officeId,
          roleIds: form.roles,
          password: form.password,
          repeatPassword: form.repeatPassword,
          passwordNeverExpires: form.passwordNeverExpires,
          sendPasswordToEmail: form.sendPasswordToEmail,
        })
        .subscribe(done);
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
