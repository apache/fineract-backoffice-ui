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

import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { AuthService } from '../../../core/services/auth.service';
import { OtpDeliveryMethod, TwoFactorAuthService } from '../../../core/services/two-factor.service';

/**
 * The second half of signing in, where Fineract asks for a one-time token.
 *
 * Reached only when `/v1/authentication` answered `isTwoFactorAuthenticationRequired`. The
 * password has already been accepted at this point — the Basic credential is live and is what
 * authorises the calls below — but it opens the `/v1/twofactor` endpoints and nothing else, so
 * this step is the whole application until it completes.
 *
 * Three states, in order: choose where to send the token, wait for it to arrive, enter it. The
 * first collapses when the platform offers only one channel, which is the common case.
 */
@Component({
  selector: 'app-two-factor-step',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <section class="two-factor" aria-labelledby="two-factor-heading">
      <h2 id="two-factor-heading" #heading tabindex="-1">
        {{ 'login.twoFactor.title' | appTranslate }}
      </h2>

      @if (error()) {
        <p id="two-factor-error" class="two-factor__error" role="alert">{{ error() }}</p>
      }

      @if (!requested()) {
        <p class="two-factor__lede">{{ 'login.twoFactor.chooseLede' | appTranslate }}</p>

        @if (loadingMethods()) {
          <p class="two-factor__status" role="status">
            {{ 'login.twoFactor.loadingMethods' | appTranslate }}
          </p>
        } @else if (methods().length === 0) {
          <!--
            The platform decides which channels a user has; with none configured there is no way
            to finish signing in, and saying so is more use than an empty list.
          -->
          <p class="two-factor__error" role="alert">
            {{ 'login.twoFactor.noMethods' | appTranslate }}
          </p>
        } @else {
          <div class="two-factor__methods">
            @for (method of methods(); track method.name) {
              <button
                type="button"
                class="two-factor__method"
                [attr.data-testid]="'two-factor-method-' + method.name"
                [disabled]="isBusy()"
                (click)="onRequest(method)"
              >
                <span class="two-factor__method-name">{{ method.name }}</span>
                <span class="two-factor__method-target">{{ method.target }}</span>
              </button>
            }
          </div>
        }
      } @else {
        <p class="two-factor__lede">
          {{ 'login.twoFactor.sentTo' | appTranslate: { target: sentTo() } }}
        </p>

        <form class="two-factor__form" (ngSubmit)="onSubmit()">
          <div class="form-field">
            <label for="otp">{{ 'login.twoFactor.codeLabel' | appTranslate }}</label>
            <input
              id="otp"
              name="otp"
              #otpInput
              type="text"
              inputmode="text"
              autocomplete="one-time-code"
              autocapitalize="characters"
              spellcheck="false"
              data-testid="two-factor-code"
              [attr.aria-describedby]="error() ? 'two-factor-error' : null"
              [attr.aria-invalid]="error() ? 'true' : null"
              [ngModel]="otp()"
              (ngModelChange)="otp.set($event)"
            />
          </div>

          <button
            type="submit"
            class="submit-btn"
            data-testid="two-factor-submit"
            [disabled]="!otp().trim() || isBusy()"
          >
            @if (isBusy()) {
              <span class="spinner"></span>
              {{ 'login.twoFactor.verifying' | appTranslate }}
            } @else {
              {{ 'login.twoFactor.verify' | appTranslate }}
            }
          </button>
        </form>

        <button
          type="button"
          class="two-factor__link"
          data-testid="two-factor-resend"
          [disabled]="isBusy()"
          (click)="onResend()"
        >
          {{ 'login.twoFactor.resend' | appTranslate }}
        </button>
      }

      <button
        type="button"
        class="two-factor__link"
        data-testid="two-factor-cancel"
        (click)="onCancel()"
      >
        {{ 'login.twoFactor.cancel' | appTranslate }}
      </button>
    </section>
  `,
  styles: [
    `
      .two-factor {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .two-factor h2 {
        margin: 0;
        font-size: 1.15rem;
      }
      .two-factor h2:focus-visible {
        outline: 2px solid #3498db;
        outline-offset: 4px;
      }
      .two-factor__lede,
      .two-factor__status {
        margin: 0;
        font-size: 0.9rem;
      }
      .two-factor__methods {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .two-factor__method {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.15rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        text-align: left;
        font: inherit;
      }
      .two-factor__method:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .two-factor__method-name {
        font-weight: 600;
        text-transform: capitalize;
      }
      .two-factor__method-target {
        font-size: 0.85rem;
        opacity: 0.75;
      }
      .two-factor__error {
        margin: 0;
        color: #c0392b;
        font-size: 0.9rem;
      }
      .two-factor__link {
        border: none;
        background: none;
        padding: 0;
        color: #3498db;
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
        align-self: flex-start;
      }
      .two-factor__link:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class TwoFactorStepComponent implements AfterViewInit {
  private readonly twoFactor = inject(TwoFactorAuthService);
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18N);
  private readonly destroyRef = inject(DestroyRef);

  /** The second factor is done; the session is usable. */
  readonly completed = output<void>();
  /** The user backed out; the caller should drop the half-established session. */
  readonly cancelled = output<void>();

  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');

  protected readonly methods = signal<OtpDeliveryMethod[]>([]);
  protected readonly loadingMethods = signal(true);
  protected readonly requested = signal(false);
  protected readonly sentTo = signal('');
  protected readonly isBusy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly otp = signal('');

  private chosen: OtpDeliveryMethod | null = null;

  constructor() {
    this.twoFactor
      .deliveryMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (methods) => {
          this.methods.set(methods ?? []);
          this.loadingMethods.set(false);
          // One channel is the common case, and making the user pick from a list of one is a
          // step that only ever has one answer.
          if (methods?.length === 1) this.onRequest(methods[0]);
        },
        error: () => {
          this.methods.set([]);
          this.loadingMethods.set(false);
        },
      });
  }

  ngAfterViewInit(): void {
    // The password form has just been replaced by this; focus would otherwise stay on a button
    // that no longer exists, and a screen-reader user would get no announcement of the change.
    this.heading()?.nativeElement.focus();
  }

  protected onRequest(method: OtpDeliveryMethod): void {
    this.chosen = method;
    this.isBusy.set(true);
    this.error.set(null);

    this.twoFactor
      .requestToken(method.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isBusy.set(false);
          this.requested.set(true);
          this.sentTo.set(result?.deliveryMethod?.target ?? method.target);
        },
        error: () => {
          this.isBusy.set(false);
          this.error.set(this.i18n.translate('login.twoFactor.requestFailed'));
          // Back to the choice, so the user can try another channel rather than be stranded
          // on a form for a code that was never sent.
          this.requested.set(false);
        },
      });
  }

  protected onResend(): void {
    if (this.chosen) this.onRequest(this.chosen);
  }

  protected onSubmit(): void {
    const otp = this.otp().trim();
    if (!otp || this.isBusy()) return;

    this.isBusy.set(true);
    this.error.set(null);

    this.twoFactor
      .validate(otp)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isBusy.set(false);
          this.authService.completeTwoFactorAuthentication(result.token);
          this.completed.emit();
        },
        error: (response: { error?: { errors?: { defaultUserMessage?: string }[] } }) => {
          this.isBusy.set(false);
          this.otp.set('');
          // Fineract answers a wrong or expired code as a domain-rule violation, and the reason
          // it gives ("The provided one time token is invalid") is better than anything this
          // component could infer.
          this.error.set(
            response?.error?.errors?.[0]?.defaultUserMessage ??
              this.i18n.translate('login.twoFactor.invalidCode'),
          );
        },
      });
  }

  protected onCancel(): void {
    this.authService.logout();
    this.cancelled.emit();
  }
}
