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

import { TranslatePipe } from '../../core/adapters';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import {
  GlobalConfigurationService,
  GetGlobalConfigurationsResponse,
  PutGlobalConfigurationsRequest,
} from '../../api';
import { EditConfigurationDialogComponent } from './edit-configuration-dialog.component';
import { IonButton, IonIcon, IonToggle } from '@ionic/angular/standalone';
import { NotificationService } from '../../core/services/notification.service';
import { DialogService } from '../../core/services/dialog.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

/**
 * Component for managing global system configurations.
 */
@Component({
  selector: 'app-global-configurations',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    IonToggle,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.globalConfigurations"
      helpTextKey="HELP.GLOBAL_CONFIG_DESC"
      [columns]="columns"
      [data]="configurations()"
      [totalRecords]="configurations().length"
      [showSearch]="true"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="enabled" let-config>
        <ion-toggle
          [checked]="!!config['enabled']"
          (ionChange)="onToggleConfig(config)"
          [attr.aria-label]="'Toggle ' + config['name']"
        >
        </ion-toggle>
      </ng-template>

      <ng-template appCellTemplate="actions" let-config>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEditConfig(config)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class GlobalConfigurationsListComponent implements OnInit {
  private readonly configService = inject(GlobalConfigurationService);
  private readonly notifications = inject(NotificationService);
  private readonly dialogService = inject(DialogService);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'SETTINGS.CONFIG_NAME', sortable: true },
    { key: 'enabled', label: 'COMMON.ENABLED', sortable: true },
    { key: 'value', label: 'COMMON.VALUE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly configurations = signal<Record<string, unknown>[]>([]);

  ngOnInit(): void {
    this.loadConfigurations();
  }

  private loadConfigurations(): void {
    this.configService.getConfigurations().subscribe({
      next: (data: GetGlobalConfigurationsResponse) => {
        this.configurations.set(
          (data.globalConfiguration as unknown as Record<string, unknown>[]) || [],
        );
      },
      error: (err) => console.error('Failed to load configurations', err),
    });
  }

  onToggleConfig(config: Record<string, unknown>): void {
    const newEnabledState = !config['enabled'];
    const request: PutGlobalConfigurationsRequest = {
      enabled: newEnabledState,
    };
    const configId = config['id'] as number;

    this.configService.putConfigurationsConfigId(configId, request).subscribe({
      next: () => {
        config['enabled'] = newEnabledState;
        this.notifications.success('Configuration updated successfully');
      },
      error: () => {
        this.notifications.error('Failed to update configuration');
        this.loadConfigurations();
      },
    });
  }

  onEditConfig(config: Record<string, unknown>): void {
    this.dialogService
      .open(EditConfigurationDialogComponent, { data: { config } })
      .then((result) => {
        if (result) {
          this.notifications.success('Configuration updated successfully');
          this.loadConfigurations();
        }
      });
  }
}
