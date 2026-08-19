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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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
    CommonModule,
    FormsModule,
    CdkTableModule,
    TranslateModule,
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
          <ion-card-title>{{ 'EMAIL_MESSAGES.TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-segment [value]="activeTab()" (ionChange)="onTabChange($any($event).detail.value)">
            <ion-segment-button [value]="TAB.messages">
              <ion-label>{{ 'EMAIL_MESSAGES.MESSAGES_TAB' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.pending">
              <ion-label>{{ 'EMAIL_MESSAGES.PENDING_TAB' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.sent">
              <ion-label>{{ 'EMAIL_MESSAGES.SENT_TAB' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.failed">
              <ion-label>{{ 'EMAIL_MESSAGES.FAILED_TAB' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button [value]="TAB.configuration">
              <ion-label>{{ 'EMAIL_MESSAGES.CONFIG_TAB' | translate }}</ion-label>
            </ion-segment-button>
          </ion-segment>

          @if (activeTab() === TAB.messages) {
            <div class="tab-content">
              <ion-button color="primary" (click)="showCreateForm.set(!showCreateForm())">
                {{ 'EMAIL_MESSAGES.CREATE' | translate }}
              </ion-button>

              @if (showCreateForm()) {
                <div class="create-form">
                  <ion-item fill="outline" class="full-width">
                    <ion-label position="stacked">{{ 'EMAIL_MESSAGES.TO' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'EMAIL_MESSAGES.TO' | translate"
                      type="email"
                      [ngModel]="newTo()"
                      (ngModelChange)="newTo.set($event)"
                    ></ion-input>
                  </ion-item>
                  <ion-item fill="outline" class="full-width">
                    <ion-label position="stacked">{{
                      'EMAIL_MESSAGES.SUBJECT' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'EMAIL_MESSAGES.SUBJECT' | translate"
                      [ngModel]="newSubject()"
                      (ngModelChange)="newSubject.set($event)"
                    ></ion-input>
                  </ion-item>
                  <ion-item fill="outline" class="full-width">
                    <ion-label position="stacked">{{
                      'EMAIL_MESSAGES.BODY' | translate
                    }}</ion-label>
                    <ion-textarea
                      [attr.aria-label]="'EMAIL_MESSAGES.BODY' | translate"
                      rows="4"
                      [ngModel]="newBody()"
                      (ngModelChange)="newBody.set($event)"
                    ></ion-textarea>
                  </ion-item>
                  <ion-button color="secondary" (click)="createMessage()">
                    {{ 'EMAIL_MESSAGES.CREATE' | translate }}
                  </ion-button>
                </div>
              }

              <cdk-table [dataSource]="messages()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <cdk-header-cell *cdkHeaderCellDef>ID</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.id }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.TO' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.to }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SUBJECT' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.subject }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="status">
                  <cdk-header-cell *cdkHeaderCellDef>Status</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.status }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="actions">
                  <cdk-header-cell *cdkHeaderCellDef>Actions</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">
                    <ion-button
                      fill="clear"
                      color="danger"
                      (click)="deleteMessage(row.id)"
                      [title]="'EMAIL_MESSAGES.DELETE' | translate"
                    >
                      &#x1F5D1;
                    </ion-button>
                  </cdk-cell>
                </ng-container>
                <cdk-header-row *cdkHeaderRowDef="msgColumns"></cdk-header-row>
                <cdk-row *cdkRowDef="let row; columns: msgColumns"></cdk-row>
              </cdk-table>
            </div>
          }
          @if (activeTab() === TAB.pending) {
            <div class="tab-content">
              <cdk-table [dataSource]="pending()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <cdk-header-cell *cdkHeaderCellDef>ID</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.id }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.TO' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.to }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SUBJECT' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.subject }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="sentDate">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SENT_DATE' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.sentDate }}</cdk-cell>
                </ng-container>
                <cdk-header-row *cdkHeaderRowDef="queueColumns"></cdk-header-row>
                <cdk-row *cdkRowDef="let row; columns: queueColumns"></cdk-row>
              </cdk-table>
            </div>
          }
          @if (activeTab() === TAB.sent) {
            <div class="tab-content">
              <cdk-table [dataSource]="sent()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <cdk-header-cell *cdkHeaderCellDef>ID</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.id }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.TO' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.to }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SUBJECT' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.subject }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="sentDate">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SENT_DATE' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.sentDate }}</cdk-cell>
                </ng-container>
                <cdk-header-row *cdkHeaderRowDef="queueColumns"></cdk-header-row>
                <cdk-row *cdkRowDef="let row; columns: queueColumns"></cdk-row>
              </cdk-table>
            </div>
          }
          @if (activeTab() === TAB.failed) {
            <div class="tab-content">
              <cdk-table [dataSource]="failed()" class="full-width">
                <ng-container cdkColumnDef="id">
                  <cdk-header-cell *cdkHeaderCellDef>ID</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.id }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="to">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.TO' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.to }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="subject">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SUBJECT' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.subject }}</cdk-cell>
                </ng-container>
                <ng-container cdkColumnDef="sentDate">
                  <cdk-header-cell *cdkHeaderCellDef>{{
                    'EMAIL_MESSAGES.SENT_DATE' | translate
                  }}</cdk-header-cell>
                  <cdk-cell *cdkCellDef="let row">{{ row.sentDate }}</cdk-cell>
                </ng-container>
                <cdk-header-row *cdkHeaderRowDef="queueColumns"></cdk-header-row>
                <cdk-row *cdkRowDef="let row; columns: queueColumns"></cdk-row>
              </cdk-table>
            </div>
          }
          @if (activeTab() === TAB.configuration) {
            <div class="tab-content">
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">Configuration JSON</ion-label>
                <ion-textarea
                  aria-label="Configuration JSON"
                  rows="10"
                  [ngModel]="configJson()"
                  (ngModelChange)="configJson.set($event)"
                ></ion-textarea>
              </ion-item>
              <ion-button color="primary" (click)="saveConfig()">
                {{ 'EMAIL_MESSAGES.SAVE_CONFIG' | translate }}
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
  readonly newTo = signal('');
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

  createMessage(): void {
    const body = { to: this.newTo(), subject: this.newSubject(), body: this.newBody() };
    this.defaultService.postEmail(JSON.stringify(body)).subscribe({
      next: () => {
        this.notifications.success(SUCCESS_MSG);
        this.newTo.set('');
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
