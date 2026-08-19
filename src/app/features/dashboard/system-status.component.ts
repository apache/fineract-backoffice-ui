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

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonButton,
  IonSpinner,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { NgClass } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ConfigService } from '../../core/services/config.service';
import { ClientService, LoansService, SavingsAccountService } from '../../api';
import { AuthService } from '../../core/services/auth.service';
import { HasPermissionDirective } from '../../shared';
import {
  DonutChartComponent,
  ChartData,
} from '../../shared/components/charts/donut-chart.component';

/**
 * Dashboard component that displays system status and key performance metrics.
 */
@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [
    TranslateModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonButton,
    IonSpinner,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    RouterModule,
    DonutChartComponent,
    NgClass,
    HasPermissionDirective,
  ],
  template: `
    <div class="dashboard-container">
      <ion-grid class="widgets-grid-container">
        <ion-row>
          <ion-col size="12" size-sm="6" size-lg="3" *appHasPermission="'READ_CLIENT'">
            <ion-card
              class="widget-card clients"
              id="dashboard-clients-widget"
              data-testid="dashboard-clients-widget"
            >
              <ion-card-content>
                <div class="widget-header">
                  <ion-icon name="people-outline"></ion-icon>
                  <span class="widget-label">{{ 'DASHBOARD.TOTAL_CLIENTS' | translate }}</span>
                </div>
                @if (isLoading()) {
                  <div class="widget-loader">
                    <ion-spinner name="crescent"></ion-spinner>
                  </div>
                } @else {
                  <div class="widget-value">{{ clientCount() }}</div>
                  <div class="widget-trend">{{ 'DASHBOARD.ACTIVE_MEMBERS' | translate }}</div>
                }
              </ion-card-content>
            </ion-card>
          </ion-col>

          <ion-col size="12" size-sm="6" size-lg="3" *appHasPermission="'READ_LOAN'">
            <ion-card
              class="widget-card loans"
              id="dashboard-loans-widget"
              data-testid="dashboard-loans-widget"
            >
              <ion-card-content>
                <div class="widget-header">
                  <ion-icon name="wallet-outline"></ion-icon>
                  <span class="widget-label">{{ 'DASHBOARD.ACTIVE_LOANS' | translate }}</span>
                </div>
                @if (isLoading()) {
                  <div class="widget-loader">
                    <ion-spinner name="crescent"></ion-spinner>
                  </div>
                } @else {
                  <div class="widget-value">{{ activeLoans() }}</div>
                  <div class="widget-trend highlight">
                    {{ pendingLoans().length }} {{ 'DASHBOARD.PENDING_APPROVALS' | translate }}
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </ion-col>

          <ion-col size="12" size-sm="6" size-lg="3" *appHasPermission="'READ_SAVINGSACCOUNT'">
            <ion-card
              class="widget-card savings"
              id="dashboard-savings-widget"
              data-testid="dashboard-savings-widget"
            >
              <ion-card-content>
                <div class="widget-header">
                  <ion-icon name="card-outline"></ion-icon>
                  <span class="widget-label">{{ 'DASHBOARD.SAVINGS_ACCOUNTS' | translate }}</span>
                </div>
                @if (isLoading()) {
                  <div class="widget-loader">
                    <ion-spinner name="crescent"></ion-spinner>
                  </div>
                } @else {
                  <div class="widget-value">{{ savingsCount() }}</div>
                  <div class="widget-trend">
                    {{ pendingSavings().length }} {{ 'DASHBOARD.PENDING_APPROVALS' | translate }}
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </ion-col>

          <ion-col size="12" size-sm="6" size-lg="3">
            <ion-card
              class="widget-card status"
              id="dashboard-health-widget"
              data-testid="dashboard-health-widget"
            >
              <ion-card-content>
                <div class="widget-header">
                  <ion-icon name="hardware-chip-outline"></ion-icon>
                  <span class="widget-label">{{ 'DASHBOARD.SYSTEM_HEALTH' | translate }}</span>
                </div>
                <div class="widget-value healthy">{{ 'DASHBOARD.ONLINE' | translate }}</div>
                <div class="widget-trend">API: {{ currentTenant() }}</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <div class="dashboard-layout">
        <div class="main-column">
          <!--
            OR, not AND: a user who can see one kind of pending approval should get the
            card for it. A user who can see neither would otherwise be shown a reassuring
            "no pending approvals" that only means they were not allowed to look.
          -->
          <ion-card class="approval-card" *appHasPermission="['READ_LOAN', 'READ_SAVINGSACCOUNT']">
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="time-outline"></ion-icon>
                {{ 'DASHBOARD.PENDING_APPROVALS' | translate }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @if (isLoading()) {
                <div class="empty-approvals">
                  <ion-spinner name="crescent"></ion-spinner>
                </div>
              } @else if (pendingLoans().length === 0 && pendingSavings().length === 0) {
                <div class="empty-approvals">
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                  <p>{{ 'DASHBOARD.NO_PENDING_APPROVALS' | translate }}</p>
                </div>
              } @else {
                <div class="approval-list">
                  @for (loan of pendingLoans(); track loan['id']) {
                    <div class="approval-item">
                      <div class="item-info">
                        <ion-badge color="primary" class="item-type loan">LOAN</ion-badge>
                        <span class="item-id">#{{ loan['accountNo'] }}</span>
                        <span class="item-detail">{{ loan['clientName'] }}</span>
                      </div>
                      <ion-button
                        fill="clear"
                        color="primary"
                        [routerLink]="['/loans/view', loan['id']]"
                        id="dashboard-pending-loans-view-btn"
                        data-testid="dashboard-pending-loans-view-btn"
                      >
                        {{ 'COMMON.VIEW' | translate }}
                      </ion-button>
                    </div>
                  }
                  @for (savings of pendingSavings(); track savings['id']) {
                    <div class="approval-item">
                      <div class="item-info">
                        <ion-badge color="success" class="item-type savings">SAVINGS</ion-badge>
                        <span class="item-id">#{{ savings['accountNo'] }}</span>
                        <span class="item-detail">{{ savings['clientName'] }}</span>
                      </div>
                      <ion-button
                        fill="clear"
                        color="primary"
                        [routerLink]="['/products/savings-accounts/view', savings['id']]"
                        id="dashboard-pending-savings-view-btn"
                        data-testid="dashboard-pending-savings-view-btn"
                      >
                        {{ 'COMMON.VIEW' | translate }}
                      </ion-button>
                    </div>
                  }
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>

        <div class="side-column">
          <ion-card class="chart-card" *appHasPermission="'READ_LOAN'">
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="pie-chart-outline"></ion-icon>
                {{ 'DASHBOARD.LOAN_DISTRIBUTION' | translate }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <app-donut-chart [data]="loanChartData()"></app-donut-chart>
            </ion-card-content>
          </ion-card>

          <ion-card class="chart-card" *appHasPermission="'READ_SAVINGSACCOUNT'">
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="pie-chart-outline"></ion-icon>
                {{ 'DASHBOARD.SAVINGS_DISTRIBUTION' | translate }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <app-donut-chart [data]="savingsChartData()"></app-donut-chart>
            </ion-card-content>
          </ion-card>

          <ion-card class="system-card">
            <ion-card-header>
              <ion-card-title>
                <ion-icon name="settings-outline"></ion-icon>
                {{ 'DASHBOARD.SYSTEM_STATUS' | translate }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ul class="status-list">
                <li>
                  <span class="label">{{ 'DASHBOARD.RUNTIME_API' | translate }}:</span>
                  <span class="value">{{ configService.apiUrl }}</span>
                </li>
                <li>
                  <span class="label">{{ 'DASHBOARD.FALLBACK_API' | translate }}:</span>
                  <span class="value">{{ environmentUrl }}</span>
                </li>
                <li>
                  <span class="label">{{ 'DASHBOARD.ENVIRONMENT' | translate }}:</span>
                  <span class="value badge" [ngClass]="isProd ? 'prod' : 'dev'">
                    {{ (isProd ? 'DASHBOARD.PRODUCTION' : 'DASHBOARD.DEVELOPMENT') | translate }}
                  </span>
                </li>
                <li>
                  <span class="label">{{ 'DASHBOARD.ACTIVE_TENANT' | translate }}:</span>
                  <span class="value">{{ currentTenant() }}</span>
                </li>
              </ul>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .widgets-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }
      .widget-card {
        border-radius: 12px;
        border: none;
        box-shadow: var(--shadow-md);
        transition:
          transform 0.2s,
          box-shadow 0.2s;
      }
      .widget-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
      }
      .widget-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        color: var(--text-muted);
      }
      .widget-header mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
      .widget-label {
        font-size: 15px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .widget-value {
        font-size: 36px;
        font-weight: 700;
        margin-bottom: 8px;
        color: var(--text-color);
      }
      .widget-loader {
        height: 60px;
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      .widget-trend {
        font-size: 13px;
        color: var(--text-muted);
      }
      .widget-trend.highlight {
        color: var(--warning-color);
        font-weight: 600;
      }
      .healthy {
        color: var(--success-color);
      }
      .dashboard-layout {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 24px;
      }
      .main-column,
      .side-column {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .chart-card {
        border-radius: 12px;
        border: none;
        box-shadow: var(--shadow-md);
      }
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .approval-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        transition: background 0.2s;
      }
      .approval-item:hover {
        background-color: var(--hover-bg);
      }
      .approval-item:last-child {
        border-bottom: none;
      }
      .item-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .item-type {
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .item-type.loan {
        background: #e3f2fd;
        color: #1976d2;
      }
      .item-type.savings {
        background: #e8f5e9;
        color: #2e7d32;
      }
      :host-context([data-theme='dark']) .item-type.loan {
        background: rgba(52, 152, 219, 0.16);
        color: var(--primary-color);
      }
      :host-context([data-theme='dark']) .item-type.savings {
        background: rgba(46, 204, 113, 0.16);
        color: var(--success-color);
      }
      .item-id {
        font-weight: 600;
        color: var(--text-color);
      }
      .item-detail {
        color: var(--text-muted);
      }
      .empty-approvals {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        color: var(--text-muted);
      }
      .empty-approvals mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
      }
      .empty-approvals p {
        margin: 0;
        font-size: 16px;
      }
      .status-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .status-list li {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .status-list .label {
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .status-list .value {
        font-family: 'Roboto Mono', monospace;
        color: var(--text-color);
        word-break: break-all;
      }
      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        width: fit-content;
      }
      .prod {
        background: #fee2e2;
        color: #b91c1c;
      }
      .dev {
        background: #dcfce7;
        color: #15803d;
      }
      :host-context([data-theme='dark']) .prod {
        background: rgba(231, 76, 60, 0.16);
        color: var(--error-color);
      }
      :host-context([data-theme='dark']) .dev {
        background: rgba(46, 204, 113, 0.16);
        color: var(--success-color);
      }
    `,
  ],
})
export class SystemStatusComponent implements OnInit {
  protected readonly configService = inject(ConfigService);
  private readonly authService = inject(AuthService);
  private readonly clientService = inject(ClientService);
  private readonly loansService = inject(LoansService);
  private readonly savingsService = inject(SavingsAccountService);
  private readonly router = inject(Router);

  protected readonly environmentUrl = environment.fineractApiUrl;
  protected readonly isProd = environment.production;
  protected readonly currentTenant = signal('default');
  readonly isLoading = signal(true);

  /**
   * Whether this user may read the entity a widget counts.
   *
   * The dashboard is the one screen everybody lands on, so it is also the one screen where a
   * user is guaranteed to meet every widget whether or not their role covers it. Asking for
   * counts they cannot read produced a row of 403s and their error toasts on arrival — and
   * because `forkJoin` fails fast, a single refusal zeroed every other metric alongside it.
   *
   * Mirrors what `*appHasPermission` does, `rbacEnabled` included, so the request a widget makes
   * and the widget's own visibility are decided by the same rule.
   */
  private canRead(permission: string): boolean {
    return !this.configService.rbacEnabled() || this.authService.hasPermission(permission);
  }

  protected readonly canReadClients = computed(() => {
    this.authService.currentUser();
    return this.canRead('READ_CLIENT');
  });
  protected readonly canReadLoans = computed(() => {
    this.authService.currentUser();
    return this.canRead('READ_LOAN');
  });
  protected readonly canReadSavings = computed(() => {
    this.authService.currentUser();
    return this.canRead('READ_SAVINGSACCOUNT');
  });

  readonly clientCount = signal(0);
  readonly activeLoans = signal(0);
  readonly savingsCount = signal(0);

  readonly pendingLoans = signal<Record<string, unknown>[]>([]);
  readonly pendingSavings = signal<Record<string, unknown>[]>([]);

  readonly loanChartData = signal<ChartData[]>([]);
  readonly savingsChartData = signal<ChartData[]>([]);

  ngOnInit(): void {
    this.loadMetrics();
  }

  private loadMetrics(): void {
    this.isLoading.set(true);

    // `of(null)` rather than omitting the key: the shape the subscriber reads stays the same
    // whichever widgets this user can see, so there is one code path instead of two.
    const skipped = of(null as unknown as Record<string, unknown>);

    const metrics$ = forkJoin({
      clients: !this.canReadClients()
        ? skipped
        : this.clientService.getClients(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            0,
            1,
          ),
      loanActive: !this.canReadLoans()
        ? skipped
        : this.loansService.getLoans(
            undefined,
            0,
            1,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            '300',
          ),
      loanPending: !this.canReadLoans()
        ? skipped
        : this.loansService.getLoans(
            undefined,
            0,
            1,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            '100',
          ),
      loanClosed: !this.canReadLoans()
        ? skipped
        : this.loansService.getLoans(
            undefined,
            0,
            1,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            '600',
          ),
      savings: !this.canReadSavings()
        ? skipped
        : this.savingsService.getSavingsaccounts(undefined, 0, 100),
    });

    metrics$.pipe(catchError(() => of(null))).subscribe((data: Record<string, unknown> | null) => {
      this.isLoading.set(false);
      if (!data) return;

      // Clients
      const clients = data['clients'] as Record<string, unknown>;
      this.clientCount.set((clients?.['totalFilteredRecords'] as number) || 0);

      // Loans (Accurate System Totals using Fineract Status Codes)
      const loanActive = data['loanActive'] as Record<string, unknown>;
      const loanPending = data['loanPending'] as Record<string, unknown>;
      const loanClosed = data['loanClosed'] as Record<string, unknown>;

      const active = (loanActive?.['totalFilteredRecords'] as number) || 0;
      const pending = (loanPending?.['totalFilteredRecords'] as number) || 0;
      const closed = (loanClosed?.['totalFilteredRecords'] as number) || 0;

      this.activeLoans.set(active);
      this.loanChartData.set([
        { label: 'Active', value: active, color: '#2ecc71' },
        { label: 'Pending', value: pending, color: '#f39c12' },
        { label: 'Closed', value: closed, color: '#95a5a6' },
      ]);

      // Savings
      const savings = data['savings'] as Record<string, unknown>;
      if (savings) {
        const accounts = Array.from((savings['pageItems'] as unknown[]) || []) as Record<
          string,
          unknown
        >[];
        const sActive = accounts.filter(
          (a) => (a['status'] as Record<string, unknown>)?.['active'],
        ).length;
        const sPending = accounts.filter(
          (a) => (a['status'] as Record<string, unknown>)?.['submittedAndPendingApproval'],
        ).length;

        this.savingsCount.set((savings['totalFilteredRecords'] as number) || 0);
        this.pendingSavings.set(
          accounts.filter(
            (a) => (a['status'] as Record<string, unknown>)?.['submittedAndPendingApproval'],
          ),
        );

        this.savingsChartData.set([
          { label: 'Active', value: sActive, color: '#3498db' },
          { label: 'Pending', value: sPending, color: '#f39c12' },
        ]);
      }
    });

    // Separately fetch real pending list for the list widget (first 50) using status code 100.
    // Unlike the metrics above this had no `catchError` at all, so a refusal surfaced as an
    // error toast rather than as an empty widget.
    if (!this.canReadLoans()) return;
    this.loansService
      .getLoans(undefined, 0, 50, undefined, undefined, undefined, undefined, undefined, '100')
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        if (data?.pageItems) {
          this.pendingLoans.set(Array.from(data.pageItems as unknown as Record<string, unknown>[]));
        }
      });
  }
}
