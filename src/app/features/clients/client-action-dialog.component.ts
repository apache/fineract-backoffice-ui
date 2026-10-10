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

import { inject, input, Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/adapters';
import {
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  ModalController,
} from '@ionic/angular/standalone';
import { formatArrayDate, toIsoDate } from '../../core/utils/date-formatter';
import {
  CodesService,
  CodeValuesService,
  GetCodeValuesDataResponse,
  BusinessDateManagementService,
} from '../../api';

export interface ClientActionDialogData {
  title: string;
  command: string;
  clientId: number;
}

@Component({
  selector: 'app-client-action-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonTextarea,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <h2 class="dialog-title">{{ data().title | appTranslate }}</h2>
    <div class="dialog-content">
      <div class="dialog-form">
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ dateLabel | appTranslate }}</ion-label>
          <ion-datetime-button datetime="actionDate-picker"></ion-datetime-button>
          <ion-modal [keepContentsMounted]="true">
            <ng-template>
              <ion-datetime
                id="actionDate-picker"
                data-testid="actionDate-picker"
                presentation="date"
                name="actionDate"
                [ngModel]="actionDate()"
                (ngModelChange)="actionDate.set($event)"
                required
                [max]="maxDate()"
              ></ion-datetime>
            </ng-template>
          </ion-modal>
        </ion-item>

        @if (showReasonDropdown) {
          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ reasonLabel | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="reasonLabel | appTranslate"
              interface="popover"
              [(ngModel)]="reasonId"
              required
            >
              @for (reason of reasonOptions(); track reason.id) {
                <ion-select-option [value]="reason.id">{{ reason.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        }

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'COMMON.NOTE' | appTranslate }}</ion-label>
          <ion-textarea
            [attr.aria-label]="'COMMON.NOTE' | appTranslate"
            [(ngModel)]="note"
            rows="3"
          ></ion-textarea>
        </ion-item>
      </div>
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" (click)="onCancel()">{{
        'COMMON.CANCEL' | appTranslate
      }}</ion-button>
      <ion-button color="primary" (click)="onConfirm()" [disabled]="!isValid">
        {{ 'COMMON.CONFIRM' | appTranslate }}
      </ion-button>
    </div>
  `,
  styles: [
    `
      .dialog-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 8px;
        min-width: 350px;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class ClientActionDialogComponent implements OnInit {
  private readonly codesService = inject(CodesService);
  private readonly codeValuesService = inject(CodeValuesService);
  private readonly businessDateService = inject(BusinessDateManagementService);
  public readonly modalController = inject(ModalController);
  readonly data = input.required<ClientActionDialogData>();

  readonly actionDate = signal(toIsoDate(new Date()));
  readonly maxDate = signal<string | undefined>(undefined);
  reasonId?: number;
  note = '';

  readonly reasonOptions = signal<GetCodeValuesDataResponse[]>([]);

  dateLabel = '';
  reasonLabel = '';
  showReasonDropdown = false;

  ngOnInit(): void {
    this.setupConfig();
    this.loadBusinessDate();
  }

  private loadBusinessDate(): void {
    this.businessDateService.getBusinessdate().subscribe({
      next: (dates) => {
        const bd = dates.find((d) => d.type === 'BUSINESS_DATE');
        if (bd && bd.date) {
          // ion-datetime works in ISO strings, including its max bound.
          const bDate = formatArrayDate(bd.date);
          this.actionDate.set(bDate);
          this.maxDate.set(bDate);
        }
      },
    });
  }

  private setupConfig(): void {
    const activationDateLabel = 'ACTIONS.ACTIVATION_DATE';
    const config: Record<string, { date: string; reason?: string; codeName?: string }> = {
      activate: { date: activationDateLabel },
      reject: {
        date: 'ACTIONS.REJECTION_DATE',
        reason: 'ACTIONS.REJECTION_REASON',
        codeName: 'ClientRejectReason',
      },
      withdraw: {
        date: 'ACTIONS.WITHDRAWAL_DATE',
        reason: 'ACTIONS.WITHDRAWAL_REASON',
        codeName: 'ClientWithdrawReason',
      },
      close: {
        date: 'ACTIONS.CLOSURE_DATE',
        reason: 'ACTIONS.CLOSURE_REASON',
        codeName: 'ClientClosureReason',
      },
      reactivate: { date: activationDateLabel },
      undoReject: { date: activationDateLabel },
      undoWithdraw: { date: activationDateLabel },
    };

    const c = config[this.data().command];
    if (c) {
      this.dateLabel = c.date;
      if (c.reason && c.codeName) {
        this.reasonLabel = c.reason;
        this.showReasonDropdown = true;
        this.loadReasons(c.codeName);
      }
    }
  }

  private loadReasons(codeName: string): void {
    this.codesService.getCodesNameCodeName(codeName).subscribe({
      next: (code) => {
        if (code.id) {
          this.codeValuesService.getCodesCodeIdCodevalues(code.id).subscribe({
            next: (values) => this.reasonOptions.set(values),
          });
        }
      },
    });
  }

  get isValid(): boolean {
    if (!this.actionDate()) return false;
    if (this.showReasonDropdown && !this.reasonId) return false;
    return true;
  }

  onCancel(): void {
    this.modalController.dismiss();
  }

  onConfirm(): void {
    if (this.isValid) {
      this.modalController.dismiss({
        actionDate: this.actionDate(),
        reasonId: this.reasonId,
        note: this.note,
      });
    }
  }
}
