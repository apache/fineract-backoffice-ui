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

import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { I18N, TranslatePipe } from '../../core/adapters';
import { AuthService } from '../../core/services/auth.service';
import { OidcService } from '../../core/services/oidc.service';

/**
 * Where the identity provider sends the browser back after sign-in (`/auth/callback`).
 *
 * Exchanges the authorization code for tokens, asks Fineract who the token belongs to, opens the
 * session and enters the application. The session is never opened without that answer. Any failure ends on a plain message and a link back to the
 * login page; the tokens are dropped, so nobody is left half signed in.
 */
@Component({
  selector: 'app-oidc-callback',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="callback" role="main">
      @if (failed()) {
        <p class="error" role="alert" data-testid="oidc-callback-error">
          {{ message() }}
        </p>
        <a routerLink="/login" data-testid="oidc-callback-back">{{
          'login.sso.backToLogin' | appTranslate
        }}</a>
      } @else {
        <p role="status">{{ 'login.sso.completing' | appTranslate }}</p>
      }
    </div>
  `,
  styles: [
    `
      .callback {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-4);
        min-height: 100dvh;
        color: var(--text-color);
      }
      .error {
        color: var(--error-color);
        max-width: 32rem;
        text-align: center;
      }
    `,
  ],
})
export class OidcCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly oidc = inject(OidcService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18N);

  protected readonly failed = signal(false);
  protected readonly message = signal('');

  async ngOnInit(): Promise<void> {
    const params = new URLSearchParams();
    for (const key of this.route.snapshot.queryParamMap.keys) {
      params.set(key, this.route.snapshot.queryParamMap.get(key) ?? '');
    }
    try {
      await this.oidc.completeLogin(params);
    } catch {
      this.fail('login.sso.failed');
      return;
    }
    try {
      await firstValueFrom(this.auth.completeOidcLogin());
    } catch (error) {
      // 404 is what Fineract answers when the deployment does not load /v1/userdetails for OIDC
      // federation (DOCS/OIDC.md). Say so, rather than blaming the person's account.
      const notFound = (error as { status?: number } | null)?.status === 404;
      this.fail(notFound ? 'login.sso.userDetailsNotFound' : 'login.sso.userDetailsFailed');
      return;
    }
    await this.router.navigate(['/'], { replaceUrl: true });
  }

  private fail(key: string): void {
    this.message.set(this.i18n.translate(key));
    this.failed.set(true);
  }
}
