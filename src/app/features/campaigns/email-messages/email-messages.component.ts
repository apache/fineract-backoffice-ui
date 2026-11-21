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
import { Component, OnInit, signal, inject } from '@angular/core';
import { ClientSearchComponent } from '../../../shared/components/client-search/client-search.component';
import { FINERACT_LOCALE } from '../../../core/utils/date-formatter';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { DefaultService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
} from '@ionic/angular/standalone';

interface EmailMessage {
  id: number;
  to?: string;
  subject?: string;
  status?: string;
  sentDate?: string;
}

const SUCCESS_MSG = 'EMAIL_MESSAGES.SUCCESS';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const EMAIL_TAB = {
  messages: 'messages',
  pending: 'pending',
  sent: 'sent',
  failed: 'failed',
  configuration: 'configuration',
} as const;

export type EmailTab = (typeof EMAIL_TAB)[keyof typeof EMAIL_TAB];

@Component({
  selector: 'app-email-messages',
  standalone: true,
  imports: [
    ClientSearchComponent,
    CommonModule,
    FormsModule,
    CdkTableModule,
    TranslatePipe,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSegment,
    IonSegmentButton,
  ],
  template: `
    <div class="container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'EMAIL_MESSAGES.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-segment [value]="activeTab()" (ionChange)="onTabChange($any($event).detail.value)">
            <ion-segment-button [value]="TAB.messages">
              <ion-label>{{ 'EMAIL_MESSAGES.MESSAGES_TAB' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.pending">
              <ion-label>{{ 'EMAIL_MESSAGES.PENDING_TAB' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.sent">
              <ion-label>{{ 'EMAIL_MESSAGES.SENT_TAB' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.failed">
              <ion-label>{{ 'EMAIL_MESSAGES.FAILED_TAB' | appTranslate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.configuration">
              <ion-label>{{ 'EMAIL_MESSAGES.CONFIG_TAB' | appTranslate }}</ion-label>
            </ion-segment-button>
          </ion-segment>

          @if (activeTab() === TAB.messages) {
            <div class="tab-content">
              <ion-button color="primary" (click)="showCreateForm.set(!showCreateForm())">
                {{ 'EMAIL_MESSAGES.CREATE' | appTranslate }}
              </ion-button>

              @if (showCreateForm()) {
                <div class="create-form">
                  <!--
                    The recipient is a client, not an address: the platform reads the email
                    address off the client's record and refuses the send when they have none
                    ("The group, client or staff provided has no email address"). A free-text
                    address had nowhere to go in the request.
                  -->
                  <app-client-search
                    class="full-width"
                    [label]="'EMAIL_MESSAGES.TO' | appTranslate"
                    [required]="true"
                    [initialClientId]="newClientId()"
                    (clientSelected)="newClientId.set($event)"
                  ></app-client-search>
                  <ion-item fill="outline" class="full-width">
                    <ion-label position="stacked">{{
                      'EMAIL_MESSAGES.SUBJECT' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'EMAIL_MESSAGES.SUBJECT' | appTranslate"
                      [ngModel]="newSubject()"
                      (ngModelChange)="newSubject.set($event)"
                    ></ion-input>
                  </ion-item>
                  <ion-item fill="outline" class="full-width">
                    <ion-label position="stacked">{{
                      'EMAIL_MESSAGES.BODY' | appTranslate
                    }}</ion-label>
                    <ion-textarea
                      [attr.aria-label]="'EMAIL_MESSAGES.BODY' | appTranslate"
                      rows="4"
                      [ngModel]="newBody()"
                      (ngModelChange)="newBody.set($event)"
                    ></ion-textarea>
                  </ion-item>
                  <ion-button color="secondary" (click)="createMessage()">
                    {{ 'EMAIL_MESSAGES.CREATE' | appTranslate }}
                  </ion-button>
                </div>
              }

              <table cdk-table [dataSource]="messages()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.TO' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.to }}</td>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SUBJECT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.subject }}</td>
                </ng-container>
                <ng-container cdkColumnDef="status">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.STATUS' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.status }}</td>
                </ng-container>
                <ng-container cdkColumnDef="actions">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">
                    <ion-button
                      fill="clear"
                      color="danger"
                      (click)="deleteMessage(row.id)"
                      [title]="'EMAIL_MESSAGES.DELETE' | appTranslate"
                      [attr.aria-label]="'EMAIL_MESSAGES.DELETE' | appTranslate"
                    >
                      &#x1F5D1;
                    </ion-button>
                  </td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="msgColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: msgColumns"></tr>
                <tr class="no-data-row" *cdkNoDataRow>
                  <td [attr.colspan]="msgColumns.length">
                    {{ 'COMMON.NO_DATA' | appTranslate }}
                  </td>
                </tr>
              </table>
            </div>
          }
          @if (activeTab() === TAB.pending) {
            <div class="tab-content">
              <table cdk-table [dataSource]="pending()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.TO' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.to }}</td>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SUBJECT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.subject }}</td>
                </ng-container>
                <ng-container cdkColumnDef="sentDate">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SENT_DATE' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.sentDate }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="queueColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: queueColumns"></tr>
                <tr class="no-data-row" *cdkNoDataRow>
                  <td [attr.colspan]="queueColumns.length">
                    {{ 'COMMON.NO_DATA' | appTranslate }}
                  </td>
                </tr>
              </table>
            </div>
          }
          @if (activeTab() === TAB.sent) {
            <div class="tab-content">
              <table cdk-table [dataSource]="sent()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.TO' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.to }}</td>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SUBJECT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.subject }}</td>
                </ng-container>
                <ng-container cdkColumnDef="sentDate">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SENT_DATE' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.sentDate }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="queueColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: queueColumns"></tr>
                <tr class="no-data-row" *cdkNoDataRow>
                  <td [attr.colspan]="queueColumns.length">
                    {{ 'COMMON.NO_DATA' | appTranslate }}
                  </td>
                </tr>
              </table>
            </div>
          }
          @if (activeTab() === TAB.failed) {
            <div class="tab-content">
              <table cdk-table [dataSource]="failed()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.TO' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.to }}</td>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SUBJECT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.subject }}</td>
                </ng-container>
                <ng-container cdkColumnDef="sentDate">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'EMAIL_MESSAGES.SENT_DATE' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.sentDate }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="queueColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: queueColumns"></tr>
                <tr class="no-data-row" *cdkNoDataRow>
                  <td [attr.colspan]="queueColumns.length">
                    {{ 'COMMON.NO_DATA' | appTranslate }}
                  </td>
                </tr>
              </table>
            </div>
          }
          @if (activeTab() === TAB.configuration) {
            <div class="tab-content">
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{
                  'EMAIL_MESSAGES.CONFIGURATION_JSON' | appTranslate
                }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'EMAIL_MESSAGES.CONFIGURATION_JSON' | appTranslate"
                  rows="10"
                  [ngModel]="configJson()"
                  (ngModelChange)="configJson.set($event)"
                ></ion-textarea>
              </ion-item>
              <ion-button color="primary" (click)="saveConfig()">
                {{ 'EMAIL_MESSAGES.SAVE_CONFIG' | appTranslate }}
              </ion-button>
            </div>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 16px;
      }
      .tab-content {
        padding: 16px 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .no-data-row td {
        text-align: center;
        color: var(--text-muted);
      }
      .full-width {
        width: 100%;
      }
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
      }
    `,
  ],
})
export class EmailMessagesComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = EMAIL_TAB;

  readonly activeTab = signal<EmailTab>(EMAIL_TAB.messages);
  private defaultService = inject(DefaultService);
  private notifications = inject(NotificationService);

  readonly messages = signal<EmailMessage[]>([]);
  readonly pending = signal<EmailMessage[]>([]);
  readonly sent = signal<EmailMessage[]>([]);
  readonly failed = signal<EmailMessage[]>([]);
  readonly configJson = signal('');

  readonly showCreateForm = signal(false);
  /** The client the message is addressed to; the platform resolves their email itself. */
  readonly newClientId = signal<number | null>(null);
  readonly newSubject = signal('');
  readonly newBody = signal('');

  msgColumns = ['id', 'to', 'subject', 'status', 'actions'];
  queueColumns = ['id', 'to', 'subject', 'sentDate'];

  ngOnInit(): void {
    this.loadMessages();
  }

  parseJson(raw: string): EmailMessage[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  onTabChange(tab: EmailTab): void {
    this.activeTab.set(tab);
    switch (tab) {
      case EMAIL_TAB.messages:
        this.loadMessages();
        break;
      case EMAIL_TAB.pending:
        this.loadPending();
        break;
      case EMAIL_TAB.sent:
        this.loadSent();
        break;
      case EMAIL_TAB.failed:
        this.loadFailed();
        break;
      case EMAIL_TAB.configuration:
        this.loadConfig();
        break;
    }
  }

  loadMessages(): void {
    this.defaultService.getEmail().subscribe({
      next: (raw) => this.messages.set(this.parseJson(raw as string)),
      error: () => this.messages.set([]),
    });
  }

  loadPending(): void {
    this.defaultService.getEmailPendingEmail().subscribe({
      next: (raw) => this.pending.set(this.parseJson(raw as string)),
      error: () => this.pending.set([]),
    });
  }

  loadSent(): void {
    this.defaultService.getEmailSentEmail().subscribe({
      next: (raw) => this.sent.set(this.parseJson(raw as string)),
      error: () => this.sent.set([]),
    });
  }

  loadFailed(): void {
    this.defaultService.getEmailFailedEmail().subscribe({
      next: (raw) => this.failed.set(this.parseJson(raw as string)),
      error: () => this.failed.set([]),
    });
  }

  loadConfig(): void {
    this.defaultService.getEmailConfiguration().subscribe({
      next: (raw) => {
        this.configJson.set(typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
      },
      error: () => {
        this.configJson.set('');
      },
    });
  }

  /**
   * Sends a message.
   *
   * The body is the request the platform documents — `clientId`, `emailSubject`,
   * `emailMessage` — and it is sent as an object. This used to post
   * `JSON.stringify({ to, subject, body })`, which the platform refused twice over: a JSON
   * string where an object belongs ("Expected BEGIN_OBJECT but was STRING"), carrying three
   * field names it does not accept. Measured against a running Fineract; creating a message
   * from this screen could never have worked.
   */
  createMessage(): void {
    const clientId = this.newClientId();
    if (clientId === null) return;

    this.defaultService
      .postEmail({
        clientId,
        emailSubject: this.newSubject(),
        emailMessage: this.newBody(),
        locale: FINERACT_LOCALE,
      })
      .subscribe({
        next: () => {
          this.notifications.success(SUCCESS_MSG);
          this.newClientId.set(null);
          this.newSubject.set('');
          this.newBody.set('');
          this.showCreateForm.set(false);
          this.loadMessages();
        },
      });
  }

  deleteMessage(id: number): void {
    this.defaultService.deleteEmailResourceId(id).subscribe({
      next: () => {
        this.notifications.success(SUCCESS_MSG);
        this.loadMessages();
      },
    });
  }

  saveConfig(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.configJson());
    } catch {
      this.notifications.error('Invalid JSON');
      return;
    }
    this.defaultService.putEmailConfiguration(JSON.stringify(parsed)).subscribe({
      next: () => {
        this.notifications.success(SUCCESS_MSG);
      },
    });
  }
}
