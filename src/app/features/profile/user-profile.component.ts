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
import { Component, OnInit, computed, signal, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../core/adapters';
import {
  GetPasswordPreferencesTemplateResponse,
  GetUsersUserIdResponse,
  PasswordPreferencesService,
  RoleData,
  UsersService,
} from '../../api';
import { skipErrorToast } from '../../core/http/http-context';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonSpinner,
    IonIcon,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonChip,
  ],
  template: `
    <div class="profile-container">
      <ion-card class="profile-card">
        <ion-card-header>
          <ion-card-title>{{ 'PROFILE.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (isLoading()) {
            <div class="spinner-wrapper">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          } @else if (loadError()) {
            <div class="load-error" role="alert" data-testid="profile-load-error">
              <ion-icon name="alert-circle-outline"></ion-icon>
              <span>{{ 'PROFILE.LOAD_ERROR' | appTranslate }}</span>
            </div>
          }

          @if (!isLoading() && userDetails()) {
            <div>
              <div class="detail-row">
                <span class="label">{{ 'PROFILE.USERNAME' | appTranslate }}</span>
                <span class="value">{{ username }}</span>
              </div>
              <div class="detail-row">
                <span class="label">{{ 'PROFILE.DISPLAY_NAME' | appTranslate }}</span>
                <span class="value">{{ displayName }}</span>
              </div>
              <div class="detail-row">
                <span class="label">{{ 'PROFILE.OFFICE' | appTranslate }}</span>
                <span class="value">
                  {{ officeName }}
                  @if (officeId) {
                    <span class="secondary">(ID: {{ officeId }})</span>
                  }
                </span>
              </div>
              <div class="detail-row">
                <span class="label">{{ 'PROFILE.EMAIL' | appTranslate }}</span>
                <span class="value">{{ email }}</span>
              </div>
              <div class="detail-row roles-row">
                <span class="label">{{ 'PROFILE.ROLES' | appTranslate }}</span>
                <div class="roles-chips">
                  @for (role of roles; track role) {
                    <ion-chip>
                      {{ role.name || role }}
                    </ion-chip>
                  }
                </div>
              </div>

              <div class="profile-actions">
                <ion-button
                  fill="outline"
                  color="primary"
                  type="button"
                  data-testid="profile-change-password"
                  [attr.aria-expanded]="changePasswordOpen()"
                  (click)="toggleChangePassword()"
                >
                  <ion-icon name="key-outline" slot="start"></ion-icon>
                  {{ 'PROFILE.CHANGE_PASSWORD' | appTranslate }}
                </ion-button>
              </div>

              @if (changePasswordOpen()) {
                <form class="password-form" (ngSubmit)="onChangePassword()" novalidate>
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'PROFILE.NEW_PASSWORD' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PROFILE.NEW_PASSWORD' | appTranslate"
                      type="password"
                      name="newPassword"
                      autocomplete="new-password"
                      data-testid="profile-new-password"
                      [ngModel]="newPassword()"
                      (ngModelChange)="newPassword.set($event)"
                      required
                    ></ion-input>
                  </ion-item>

                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'PROFILE.REPEAT_NEW_PASSWORD' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PROFILE.REPEAT_NEW_PASSWORD' | appTranslate"
                      type="password"
                      name="repeatPassword"
                      autocomplete="new-password"
                      data-testid="profile-repeat-password"
                      [ngModel]="repeatPassword()"
                      (ngModelChange)="repeatPassword.set($event)"
                      required
                    ></ion-input>
                  </ion-item>

                  @if (passwordsMismatch()) {
                    <p class="password-error" role="alert" data-testid="profile-password-mismatch">
                      {{ 'PROFILE.PASSWORDS_DO_NOT_MATCH' | appTranslate }}
                    </p>
                  }

                  @if (passwordPolicyDescription(); as description) {
                    <p class="password-policy" data-testid="profile-password-policy">
                      {{ 'PROFILE.PASSWORD_POLICY' | appTranslate }}: {{ description }}
                    </p>
                  }

                  <div class="password-actions">
                    <ion-button
                      fill="clear"
                      color="medium"
                      type="button"
                      (click)="cancelChangePassword()"
                    >
                      {{ 'COMMON.CANCEL' | appTranslate }}
                    </ion-button>
                    <ion-button
                      color="primary"
                      type="submit"
                      data-testid="profile-password-submit"
                      [disabled]="!canChangePassword()"
                    >
                      @if (isChangingPassword()) {
                        <ion-spinner name="crescent" slot="start"></ion-spinner>
                        {{ 'COMMON.SAVING' | appTranslate }}
                      } @else {
                        {{ 'COMMON.SAVE' | appTranslate }}
                      }
                    </ion-button>
                  </div>
                </form>
              }
            </div>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .profile-container {
        padding: 24px;
        max-width: 640px;
        margin: 0 auto;
      }
      .profile-card {
        width: 100%;
      }
      .spinner-wrapper {
        display: flex;
        justify-content: center;
        padding: 32px 0;
      }
      .detail-row {
        display: flex;
        align-items: flex-start;
        padding: 12px 0;
        border-bottom: 1px solid #f0f0f0;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .label {
        font-weight: 500;
        width: 160px;
        flex-shrink: 0;
        color: var(--text-muted);
      }
      .value {
        flex: 1;
      }
      .secondary {
        color: var(--text-muted);
        font-size: 0.85em;
        margin-left: 4px;
      }
      .roles-row {
        align-items: center;
      }
      .roles-chips {
        flex: 1;
      }
      .load-error {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 24px 0;
        color: var(--error-color);
      }
      .profile-actions {
        display: flex;
        justify-content: flex-end;
        padding-top: 16px;
      }
      .password-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color, #f0f0f0);
      }
      .password-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .password-error,
      .password-policy {
        margin: 0;
        font-size: 0.875rem;
      }
      .password-error {
        color: var(--error-color);
      }
      .password-policy {
        color: var(--text-muted);
      }
    `,
  ],
})
export class UserProfileComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly passwordPreferencesService = inject(PasswordPreferencesService);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  /* Signals, not plain fields: these are written from an async callback, and a
     plain field mutated there never marks the view dirty — which is why a failed
     load previously left the spinner running forever instead of showing an
     error. */
  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly userDetails = signal<GetUsersUserIdResponse | null>(null);
  readonly changePasswordOpen = signal(false);
  readonly newPassword = signal('');
  readonly repeatPassword = signal('');
  readonly isChangingPassword = signal(false);
  readonly passwordPolicyDescription = signal<string | null>(null);

  readonly passwordsMismatch = computed(
    () => this.repeatPassword().length > 0 && this.newPassword() !== this.repeatPassword(),
  );
  readonly canChangePassword = computed(
    () =>
      this.newPassword().length > 0 &&
      this.newPassword() === this.repeatPassword() &&
      !this.isChangingPassword(),
  );

  get username(): string {
    return this.userDetails()?.username ?? '';
  }

  get displayName(): string {
    const user = this.userDetails();
    return [user?.firstname, user?.lastname].filter(Boolean).join(' ');
  }

  get officeName(): string {
    return this.userDetails()?.officeName ?? '';
  }

  get officeId(): number | undefined {
    return this.userDetails()?.officeId;
  }

  get email(): string {
    return this.userDetails()?.email ?? '';
  }

  get roles(): RoleData[] {
    return this.userDetails()?.selectedRoles ?? [];
  }

  toggleChangePassword(): void {
    const open = !this.changePasswordOpen();
    this.changePasswordOpen.set(open);
    if (open) {
      this.loadPasswordPolicy();
      return;
    }
    this.resetPasswordForm();
  }

  cancelChangePassword(): void {
    this.changePasswordOpen.set(false);
    this.resetPasswordForm();
  }

  onChangePassword(): void {
    const userId = this.authService.currentUser()?.userId;
    if (userId == null || !this.canChangePassword()) return;

    this.isChangingPassword.set(true);
    this.usersService
      .postUsersUserIdPwd(userId, {
        password: this.newPassword(),
        repeatPassword: this.repeatPassword(),
      })
      .subscribe({
        next: () => {
          this.isChangingPassword.set(false);
          this.changePasswordOpen.set(false);
          this.resetPasswordForm();
          void this.notifications.success(this.i18n.translate('PROFILE.PASSWORD_CHANGED'));
        },
        error: () => this.isChangingPassword.set(false),
      });
  }

  private resetPasswordForm(): void {
    this.newPassword.set('');
    this.repeatPassword.set('');
  }

  private loadPasswordPolicy(): void {
    this.passwordPreferencesService
      .getPasswordpreferences('body', false, { context: skipErrorToast() })
      .subscribe({
        next: (response) => {
          const policies: GetPasswordPreferencesTemplateResponse[] = Array.isArray(response)
            ? response
            : [response];
          this.passwordPolicyDescription.set(
            policies.find((policy) => policy.active)?.description ?? null,
          );
        },
        error: () => this.passwordPolicyDescription.set(null),
      });
  }

  ngOnInit(): void {
    /* GET /userdetails is not present on every Fineract build (it 404s on the
       current one), while GET /users/{id} is, and carries the same fields plus
       the user's selected roles. Resolve the id from the session established at
       login rather than asking the server who we are. */
    const userId = this.authService.currentUser()?.userId;
    if (userId == null) {
      this.isLoading.set(false);
      this.loadError.set(true);
      return;
    }

    this.isLoading.set(true);
    this.usersService.getUsersUserId(userId).subscribe({
      next: (data) => {
        this.userDetails.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set(true);
      },
    });
  }
}
