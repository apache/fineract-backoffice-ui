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

import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { TranslatePipe } from '../core/adapters';
import { IonIcon } from '@ionic/angular/standalone';
import { buildBreadcrumbs } from './breadcrumb';
import { BreadcrumbService } from '../core/services/breadcrumb.service';

/**
 * Orientation trail above the page content — "Clients / Details" — built from each activated
 * route's `title`. See `breadcrumb.ts` for how the trail itself is derived.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterModule, TranslatePipe, IonIcon],
  template: `
    @if (crumbs().length > 1) {
      <nav class="breadcrumb" aria-label="Breadcrumb">
        @for (crumb of crumbs(); track crumb.url; let last = $last) {
          @if (!last) {
            <a [routerLink]="crumb.url">
              @if (crumb.label.kind === 'translation') {
                {{ crumb.label.key | appTranslate: crumb.label.params }}
              } @else {
                {{ crumb.label.text }}
              }
            </a>
            <ion-icon name="chevron-forward-outline"></ion-icon>
          } @else {
            <span class="current" aria-current="page">
              @if (crumb.label.kind === 'translation') {
                {{ crumb.label.key | appTranslate: crumb.label.params }}
              } @else {
                {{ crumb.label.text }}
              }
            </span>
          }
        }
      </nav>
    }
  `,
  styles: [
    `
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 0 12px;
        font-size: 0.85rem;
        color: var(--text-color-secondary);
      }
      .breadcrumb a {
        color: var(--text-color-secondary);
        text-decoration: none;
      }
      .breadcrumb a:hover {
        text-decoration: underline;
      }
      .breadcrumb ion-icon {
        font-size: 0.85rem;
      }
      .breadcrumb .current {
        color: var(--text-color);
        font-weight: 500;
      }
    `,
  ],
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly breadcrumbService = inject(BreadcrumbService);

  protected readonly routeCrumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => buildBreadcrumbs(this.router.routerState.snapshot.root)),
    ),
    { initialValue: buildBreadcrumbs(this.router.routerState.snapshot.root) },
  );

  protected readonly crumbs = computed(
    () => this.breadcrumbService.override() ?? this.routeCrumbs(),
  );

  protected readonly hasCrumbs = computed(() => this.crumbs().length > 1);
}
