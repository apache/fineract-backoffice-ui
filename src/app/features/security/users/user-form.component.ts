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

import { Component, OnInit, computed, inject, signal } from '@angular/core';

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
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import type { NamedOption } from '../../../core/adapters';
import { unmetRules } from '../../../core/security/password-policy';
import type { PasswordPolicy, PasswordRule } from '../../../core/security/password-policy';

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
  passwordNeverExpires: boolean;
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
    IonNote,
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
              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'USERS.USERNAME' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'USERS.USERNAME' | appTranslate"
                    name="username"
                    [(ngModel)]="user().username"
                    #usernameModel="ngModel"
                    (ionBlur)="usernameModel.control.markAsTouched()"
                    required
                    [disabled]="isEditMode()"
                    id="user-username-input"
                    data-testid="user-username-input"
                    [attr.aria-invalid]="usernameModel.invalid && usernameModel.touched"
                    [attr.aria-describedby]="
                      usernameModel.invalid && usernameModel.touched ? 'user-username-error' : null
                    "
                  ></ion-input>
                </ion-item>
                @if (usernameModel.invalid && usernameModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="user-username-error"
                    role="alert"
                    data-testid="user-username-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>

              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'CLIENTS.FIRST_NAME' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'CLIENTS.FIRST_NAME' | appTranslate"
                    name="firstname"
                    [(ngModel)]="user().firstname"
                    #firstnameModel="ngModel"
                    (ionBlur)="firstnameModel.control.markAsTouched()"
                    required
                    id="user-firstname-input"
                    data-testid="user-firstname-input"
                    [attr.aria-invalid]="firstnameModel.invalid && firstnameModel.touched"
                    [attr.aria-describedby]="
                      firstnameModel.invalid && firstnameModel.touched
                        ? 'user-firstname-error'
                        : null
                    "
                  ></ion-input>
                </ion-item>
                @if (firstnameModel.invalid && firstnameModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="user-firstname-error"
                    role="alert"
                    data-testid="user-firstname-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>

              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'CLIENTS.LAST_NAME' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'CLIENTS.LAST_NAME' | appTranslate"
                    name="lastname"
                    [(ngModel)]="user().lastname"
                    #lastnameModel="ngModel"
                    (ionBlur)="lastnameModel.control.markAsTouched()"
                    required
                    id="user-lastname-input"
                    data-testid="user-lastname-input"
                    [attr.aria-invalid]="lastnameModel.invalid && lastnameModel.touched"
                    [attr.aria-describedby]="
                      lastnameModel.invalid && lastnameModel.touched ? 'user-lastname-error' : null
                    "
                  ></ion-input>
                </ion-item>
                @if (lastnameModel.invalid && lastnameModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="user-lastname-error"
                    role="alert"
                    data-testid="user-lastname-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>

              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'COMMON.EMAIL' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'COMMON.EMAIL' | appTranslate"
                    type="email"
                    name="email"
                    [(ngModel)]="user().email"
                    #emailModel="ngModel"
                    (ionBlur)="emailModel.control.markAsTouched()"
                    required
                    id="user-email-input"
                    data-testid="user-email-input"
                    [attr.aria-invalid]="emailModel.invalid && emailModel.touched"
                    [attr.aria-describedby]="
                      emailModel.invalid && emailModel.touched ? 'user-email-error' : null
                    "
                  ></ion-input>
                </ion-item>
                @if (emailModel.invalid && emailModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="user-email-error"
                    role="alert"
                    data-testid="user-email-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>

              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked">
                    <span>{{ 'COMMON.OFFICE' | appTranslate }}</span
                    ><span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                    interface="popover"
                    name="officeId"
                    [(ngModel)]="user().officeId"
                    #officeIdModel="ngModel"
                    (ionBlur)="officeIdModel.control.markAsTouched()"
                    required
                    id="user-office-select"
                    data-testid="user-office-select"
                    [attr.aria-invalid]="officeIdModel.invalid && officeIdModel.touched"
                    [attr.aria-describedby]="
                      officeIdModel.invalid && officeIdModel.touched ? 'user-office-error' : null
                    "
                  >
                    @for (office of offices(); track office.id) {
                      <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                @if (officeIdModel.invalid && officeIdModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="user-office-error"
                    role="alert"
                    data-testid="user-office-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>

              <!--
                Hidden when the platform is to mail a generated password: it refuses a request
                that carries both, and a field that must be left blank is worse than no field.
              -->
              @if (!isEditMode() && !sendPasswordToEmail()) {
                <div class="field">
                  <ion-item fill="outline">
                    <ion-label position="stacked"
                      >{{ 'USERS.PASSWORD' | appTranslate
                      }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-input
                      [attr.aria-label]="'USERS.PASSWORD' | appTranslate"
                      type="password"
                      name="password"
                      autocomplete="new-password"
                      [ngModel]="password()"
                      (ngModelChange)="password.set($event)"
                      #passwordModel="ngModel"
                      (ionBlur)="passwordModel.control.markAsTouched()"
                      required
                      id="user-password-input"
                      data-testid="user-password-input"
                      [attr.aria-invalid]="unmetPasswordRules().length > 0 && passwordModel.touched"
                      [attr.aria-describedby]="
                        unmetPasswordRules().length > 0 && passwordModel.touched
                          ? 'user-password-error'
                          : 'user-password-policy'
                      "
                    ></ion-input>
                  </ion-item>
                  <!--
                    The policy as the platform words it. Tenant-configurable, so it is read
                    rather than restated: GET /passwordpreferences answers the active one.
                  -->
                  @if (passwordPolicy(); as policy) {
                    <ion-note
                      color="medium"
                      class="field-hint"
                      id="user-password-policy"
                      data-testid="user-password-policy"
                      >{{ 'USERS.PASSWORD_POLICY' | appTranslate }}:
                      {{ policy.description }}</ion-note
                    >
                  }
                  <!--
                    Which rules this password still fails, rather than the whole policy again.
                    The platform's own refusal lists every rule and names none of them, so a
                    password rejected for a single repeated character reads as a wall of text.
                  -->
                  @if (unmetPasswordRules().length > 0 && passwordModel.touched) {
                    <ion-note
                      color="danger"
                      class="field-error"
                      id="user-password-error"
                      role="alert"
                      data-testid="user-password-error"
                    >
                      {{ 'USERS.PASSWORD_RULES_UNMET' | appTranslate }}
                      @for (rule of unmetPasswordRules(); track rule.id) {
                        <span [attr.data-testid]="'user-password-rule-' + rule.id"
                          >{{ rule.labelKey | appTranslate: rule.params }}
                          @if (!$last) {
                            ,
                          }
                        </span>
                      }
                    </ion-note>
                  }
                </div>

                <div class="field">
                  <ion-item fill="outline">
                    <ion-label position="stacked"
                      >{{ 'USERS.REPEAT_PASSWORD' | appTranslate
                      }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-input
                      [attr.aria-label]="'USERS.REPEAT_PASSWORD' | appTranslate"
                      type="password"
                      name="repeatPassword"
                      autocomplete="new-password"
                      [ngModel]="repeatPassword()"
                      (ngModelChange)="repeatPassword.set($event)"
                      #repeatPasswordModel="ngModel"
                      (ionBlur)="repeatPasswordModel.control.markAsTouched()"
                      required
                      id="user-repeat-password-input"
                      data-testid="user-repeat-password-input"
                      [attr.aria-invalid]="
                        (repeatPasswordModel.invalid || passwordsMismatch()) &&
                        repeatPasswordModel.touched
                      "
                      [attr.aria-describedby]="
                        (repeatPasswordModel.invalid || passwordsMismatch()) &&
                        repeatPasswordModel.touched
                          ? 'user-repeat-password-error'
                          : null
                      "
                    ></ion-input>
                  </ion-item>
                  @if (repeatPasswordModel.touched && repeatPasswordModel.invalid) {
                    <ion-note
                      color="danger"
                      class="field-error"
                      id="user-repeat-password-error"
                      role="alert"
                      data-testid="user-repeat-password-error"
                      >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                    >
                  } @else if (repeatPasswordModel.touched && passwordsMismatch()) {
                    <ion-note
                      color="danger"
                      class="field-error"
                      id="user-repeat-password-error"
                      role="alert"
                      data-testid="user-password-mismatch"
                      >{{ 'USERS.PASSWORDS_DO_NOT_MATCH' | appTranslate }}</ion-note
                    >
                  }
                </div>
              }

              <div class="field full-width">
                <ion-item fill="outline" class="full-width">
                  <ion-label position="stacked"
                    >{{ 'USERS.ROLES' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'USERS.ROLES' | appTranslate"
                    interface="popover"
                    name="roles"
                    [(ngModel)]="user().roles"
                    multiple
                    required
                    #rolesModel="ngModel"
                    (ionBlur)="rolesModel.control.markAsTouched()"
                    id="user-roles-select"
                    data-testid="user-roles-select"
                    [attr.aria-invalid]="rolesModel.invalid && rolesModel.touched"
                    [attr.aria-describedby]="
                      rolesModel.invalid && rolesModel.touched ? 'user-roles-error' : null
                    "
                  >
                    @for (role of availableRoles(); track role.id) {
                      <ion-select-option [value]="role.id">{{ role.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                @if (rolesModel.invalid && rolesModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="user-roles-error"
                    role="alert"
                    data-testid="user-roles-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>
            </div>

            <div class="checkbox-container" style="display: flex; gap: 16px; flex-wrap: wrap;">
              <ion-checkbox name="passwordNeverExpires" [(ngModel)]="user().passwordNeverExpires">
                {{ 'USERS.PASSWORD_NEVER_EXPIRES' | appTranslate }}
              </ion-checkbox>

              <ion-checkbox
                name="sendPasswordToEmail"
                data-testid="user-send-password-to-email"
                [ngModel]="sendPasswordToEmail()"
                (ngModelChange)="sendPasswordToEmail.set($event)"
              >
                {{ 'USERS.SEND_PASSWORD_TO_EMAIL' | appTranslate }}
              </ion-checkbox>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                data-testid="user-submit"
                [disabled]="userForm.invalid || !passwordAcceptable() || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
              </ion-button>
            </div>
            @if (userForm.invalid || !passwordAcceptable()) {
              <ion-note
                color="medium"
                class="submit-hint"
                data-testid="user-submit-hint"
                aria-live="polite"
                >{{ 'COMMON.COMPLETE_REQUIRED_FIELDS' | appTranslate }}</ion-note
              >
            }
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
      .field {
        display: flex;
        flex-direction: column;
      }
      .full-width {
        grid-column: 1 / -1;
      }
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
      .field-error {
        display: block;
        padding-inline-start: 4px;
        margin-top: -4px;
        font-size: 0.8125rem;
      }
      .submit-hint {
        display: block;
        text-align: end;
        font-size: 0.8125rem;
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
    passwordNeverExpires: false,
  });

  readonly offices = signal<NamedOption[]>([]);
  readonly availableRoles = signal<NamedOption[]>([]);

  /**
   * The password pair, and the mail-it-instead flag, as signals rather than fields of
   * {@link user}.
   *
   * `[(ngModel)]="user().password"` mutates the object the signal holds, which never notifies
   * the signal — so nothing derived from it would recompute, and the rule list below would
   * never update as the user types. The same trap emptied the floating-rate editor (#815).
   */
  readonly password = signal('');
  readonly repeatPassword = signal('');
  readonly sendPasswordToEmail = signal(false);

  /** The tenant's active policy, for the helper text and the rules below. `null` until read. */
  readonly passwordPolicy = signal<PasswordPolicy | null>(null);

  /**
   * The rules this password still fails.
   *
   * Empty where no password is being set — an edit, or a generated one mailed to the user — so
   * the gate below is about the fields that are actually on screen.
   */
  readonly unmetPasswordRules = computed<readonly PasswordRule[]>(() =>
    this.isEditMode() || this.sendPasswordToEmail()
      ? []
      : unmetRules(this.password(), this.passwordPolicy()),
  );

  /** Whether the confirmation differs from the password. Silent until one has been typed. */
  readonly passwordsMismatch = computed(
    () => this.repeatPassword().length > 0 && this.password() !== this.repeatPassword(),
  );

  /**
   * Whether the password half of this form can be submitted.
   *
   * Both halves are the platform's rules, checked here only so the user learns them from the
   * form rather than one round trip at a time (#753). Fineract validates both again, and its
   * refusal — which used to be the only feedback — carried the submitted password in clear
   * text (#752).
   */
  readonly passwordAcceptable = computed(
    () => this.unmetPasswordRules().length === 0 && !this.passwordsMismatch(),
  );

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
    // The policy, not a copy of it: it is tenant-configurable, and an unread one leaves the
    // rules at their loosest rather than refusing a password the platform would have taken.
    this.userApi.passwordPolicy().subscribe({
      next: (policy) => this.passwordPolicy.set(policy),
      error: () => this.passwordPolicy.set(null),
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
        passwordNeverExpires: member.passwordNeverExpires,
      });
      // Never prefilled, and not rendered in edit mode either: Fineract changes a password
      // through its own endpoint, which the profile screen owns.
      this.password.set('');
      this.repeatPassword.set('');
      this.sendPasswordToEmail.set(false);
    });
  }

  onSubmit(): void {
    const form = this.user();
    // Checked here as well as on the button: a form submitted by Enter does not consult the
    // button's disabled state.
    if (!this.passwordAcceptable()) return;
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
          sendPasswordToEmail: this.sendPasswordToEmail(),
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
          password: this.password(),
          repeatPassword: this.repeatPassword(),
          passwordNeverExpires: form.passwordNeverExpires,
          sendPasswordToEmail: this.sendPasswordToEmail(),
        })
        .subscribe(done);
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
