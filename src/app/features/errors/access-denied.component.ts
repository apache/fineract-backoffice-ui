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

import { AfterViewInit, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../core/adapters';
import { REQUIRED_PERMISSIONS_PARAM } from '../../core/guards/permission.guard';
import { PermissionSummaryPipe } from '../../shared/pipes/permission-summary.pipe';

/**
 * The page a user lands on when `permissionGuard` refuses a route.
 *
 * Refusal has to be legible. The alternative the router offers — letting the match fail and
 * falling through to the wildcard — drops the user on the dashboard with no indication that
 * anything was denied, which reads as a broken link rather than a decision. So this page names
 * what happened, says who to ask, and offers the one action that is certain to work.
 *
 * It names the permissions the screen wanted, when the guard passed them along. Everyone who
 * reaches this page is authenticated back-office staff, so the codes are not a hint to an
 * outsider — they are the one piece of information that lets the user tell an administrator
 * exactly what to grant, instead of opening a support conversation to find out.
 *
 * Accessibility carries the page. A guard redirect is a navigation the user did not ask for, so
 * the heading takes focus on activation — otherwise focus stays wherever the previous page left
 * it and a screen-reader user is given no reason for the change — and the region announces
 * itself politely rather than interrupting.
 */
@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink, IonButton, IonIcon, TranslatePipe, PermissionSummaryPipe],
  template: `
    <div class="access-denied" role="alert" aria-live="polite">
      <ion-icon name="lock-closed-outline" class="access-denied__icon" aria-hidden="true" />

      <!--
        tabindex="-1" makes the heading programmatically focusable without adding it to the tab
        order; the focus call below is the only thing that ever puts focus here.
      -->
      <h1 #heading tabindex="-1" class="access-denied__title">
        {{ 'ACCESS_DENIED.TITLE' | appTranslate }}
      </h1>

      <p class="access-denied__message">{{ 'ACCESS_DENIED.MESSAGE' | appTranslate }}</p>

      @if (requiredPermissions().length) {
        <p class="access-denied__required" data-testid="access-denied-required">
          {{ 'ACCESS_DENIED.REQUIRES' | appTranslate }}
          <!--
            Both forms, deliberately. The sentence is what the user reads; the code is what they
            quote to an administrator, and it is the only one of the two that is unambiguous.
          -->
          <span class="access-denied__required-plain">
            {{ requiredPermissions() | permissionSummary }}
          </span>
          <code>{{ requiredPermissions().join(', ') }}</code>
        </p>
      }

      <p class="access-denied__hint">{{ 'ACCESS_DENIED.HINT' | appTranslate }}</p>

      <ion-button routerLink="/dashboard" data-testid="access-denied-dashboard">
        {{ 'ACCESS_DENIED.BACK_TO_DASHBOARD' | appTranslate }}
      </ion-button>
    </div>
  `,
  styles: [
    `
      .access-denied {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 48px 24px;
        text-align: center;
      }
      .access-denied__icon {
        font-size: 56px;
        color: var(--ion-color-medium);
      }
      .access-denied__title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }
      /* Focus lands here by script, not by tabbing, so the ring is the only cue that it moved. */
      .access-denied__title:focus-visible {
        outline: 2px solid var(--ion-color-primary);
        outline-offset: 4px;
      }
      .access-denied__message {
        margin: 0;
        max-width: 44ch;
      }
      .access-denied__required {
        margin: 0;
        max-width: 44ch;
        font-size: 0.9rem;
      }
      .access-denied__required-plain {
        display: block;
      }
      .access-denied__required code {
        font-family: monospace;
        word-break: break-word;
      }
      .access-denied__hint {
        margin: 0 0 8px;
        max-width: 44ch;
        color: var(--ion-color-medium);
        font-size: 0.9rem;
      }
    `,
  ],
})
export class AccessDeniedComponent implements AfterViewInit {
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap);

  /** Codes the refused route declared, as the guard passed them on. Empty when it did not. */
  readonly requiredPermissions = computed(() =>
    (this.queryParams()?.get(REQUIRED_PERMISSIONS_PARAM) ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean),
  );

  ngAfterViewInit(): void {
    this.heading().nativeElement.focus();
  }
}
