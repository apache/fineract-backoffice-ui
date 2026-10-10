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
import { TranslatePipe } from '../../../core/adapters';
import { NotificationService, GetNotification } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonList,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Notifications: list user notifications (read / unread) and mark them all read
 * via the notifications endpoint.
 */
@Component({
  selector: 'app-notifications-config',
  standalone: true,
  imports: [
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonItem,
    IonList,
    IonIcon,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'NOTIFICATIONS_CONFIG.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (notifications().length) {
            <ion-list>
              @for (note of notifications(); track note.id) {
                <ion-item>
                  <ion-icon
                    slot="start"
                    [name]="note.isRead ? 'mail-open-outline' : 'mail-outline'"
                  ></ion-icon>
                  <span>{{ note.content }}</span>
                  <span>{{ note.createdAt }}</span>
                </ion-item>
              }
            </ion-list>
          } @else {
            <p>{{ 'NOTIFICATIONS_CONFIG.EMPTY' | appTranslate }}</p>
          }

          <div class="form-actions">
            <ion-button
              color="primary"
              type="button"
              [disabled]="isSaving()"
              (click)="onMarkAllRead()"
            >
              @if (isSaving()) {
                <ion-spinner name="crescent"></ion-spinner>
                {{ 'COMMON.SAVING' | appTranslate }}
              } @else {
                {{ 'NOTIFICATIONS_CONFIG.MARK_ALL_READ' | appTranslate }}
              }
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      }
    `,
  ],
})
export class NotificationsConfigComponent implements OnInit {
  private readonly service = inject(NotificationService);

  readonly notifications = signal<GetNotification[]>([]);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.getNotifications().subscribe((data) => {
      this.notifications.set(data.pageItems ?? []);
    });
  }

  onMarkAllRead(): void {
    this.isSaving.set(true);
    this.service.putNotifications().subscribe({
      next: () => {
        this.isSaving.set(false);
        this.load();
      },
      error: () => this.isSaving.set(false),
    });
  }
}
