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

import { Component, computed, inject, signal } from '@angular/core';
import {
  ACCOUNT_NUMBER_FORMAT_API,
  I18N,
  TranslatePipe,
  type AccountNumberFormat,
  type AccountNumberFormatTemplate,
  type NumberFormatOption,
} from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
  RequiresPermissionDirective,
} from '../../../shared';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Account number formats: how Fineract numbers each kind of account.
 *
 * Fineract keeps at most one format per account type, and `PUT` carries `prefixType` alone — the
 * account type is fixed once the format exists. Both facts shape the screen: Add offers only the
 * types that have no format yet, and changing a prefix is its own action rather than an edit form
 * with a field that would be ignored.
 */
@Component({
  selector: 'app-account-number-formats',
  standalone: true,
  imports: [
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
    TranslatePipe,
    ButtonComponent,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.accountNumberFormats"
      helpTextKey="HELP.ACCOUNT_NUMBER_FORMATS_DESC"
      [createButtonLabel]="addLabel()"
      createPermission="CREATE_ACCOUNTNUMBERFORMAT"
      [columns]="columns"
      [data]="formats()"
      [localLogic]="true"
      (create)="onAddFormat()"
    >
      <ng-template appCellTemplate="prefix" let-format>
        {{ format.prefix ?? ('SYSTEM.NO_PREFIX' | appTranslate) }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-format>
        @if (prefixesFor(format).length > 0) {
          <app-button
            type="button"
            emphasis="quiet"
            icon="pricetag-outline"
            appRequiresPermission="UPDATE_ACCOUNTNUMBERFORMAT"
            (click)="onSetPrefix(format)"
            [label]="'SYSTEM.SET_PREFIX' | appTranslate"
          />
        }
        <app-button
          type="button"
          emphasis="quiet"
          intent="danger"
          icon="trash-outline"
          appRequiresPermission="DELETE_ACCOUNTNUMBERFORMAT"
          (click)="onDeleteFormat(format)"
          [label]="'COMMON.DELETE' | appTranslate"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class AccountNumberFormatsComponent {
  private readonly api = inject(ACCOUNT_NUMBER_FORMAT_API);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly formats = signal<AccountNumberFormat[]>([]);
  readonly hasError = signal(false);
  /** What the platform allows, read once alongside the list. */
  readonly template = signal<AccountNumberFormatTemplate | null>(null);

  /**
   * The account types still without a format.
   *
   * Fineract keeps at most one per type and refuses a second, so when this is empty the Add
   * button is withheld: an empty label hides it in `app-data-table`. Saying "every type already
   * has one" in a toast would explain a button that should not have been offered.
   */
  readonly availableTypes = computed(() => {
    const configured = new Set(this.formats().map((format) => format.accountTypeId));
    return (this.template()?.accountTypes ?? []).filter((type) => !configured.has(type.id));
  });

  readonly addLabel = computed(() =>
    this.availableTypes().length > 0 ? 'SYSTEM.ADD_ACCOUNT_NUMBER_FORMAT' : '',
  );

  readonly columns: ColumnDef[] = [
    { key: 'accountType', label: 'SYSTEM.ACCOUNT_TYPE', sortable: true },
    { key: 'prefix', label: 'SYSTEM.NUMBER_PREFIX', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  constructor() {
    this.load();
  }

  onRetry(): void {
    this.load();
  }

  private load(): void {
    this.api.list().subscribe({
      next: (formats) => {
        this.hasError.set(false);
        this.formats.set(formats);
      },
      error: (err: unknown) => {
        this.hasError.set(true);
        this.formats.set([]);
        console.error('Failed to load account number formats', err);
      },
    });
    // Read alongside the list rather than when a dialog opens: what it answers decides which
    // actions are offered at all, so it cannot wait for a click.
    this.api.template().subscribe({
      next: (template) => this.template.set(template),
      error: (err: unknown) => {
        console.error('Failed to load the account number format template', err);
      },
    });
  }

  /** The prefixes this format's account type allows, keyed by label as Fineract keys them. */
  prefixesFor(format: AccountNumberFormat): readonly NumberFormatOption[] {
    return this.template()?.prefixesByAccountType[format.accountType] ?? [];
  }

  /**
   * Adds a format for an account type that has none.
   *
   * The prefix is deliberately not collected here. Its options depend on the account type being
   * chosen in the same dialog, which a static field list cannot follow, and the platform treats
   * the two separately anyway: the row's Set Prefix action then offers exactly the prefixes that
   * type allows.
   */
  async onAddFormat(): Promise<void> {
    const available = this.availableTypes();
    if (available.length === 0) {
      return;
    }

    const values = await this.dialog.prompt({
      title: this.i18n.translate('SYSTEM.ADD_ACCOUNT_NUMBER_FORMAT'),
      message: this.i18n.translate('SYSTEM.ADD_ACCOUNT_NUMBER_FORMAT_PROMPT'),
      fields: [
        {
          name: 'accountType',
          label: this.i18n.translate('SYSTEM.ACCOUNT_TYPE'),
          type: 'select',
          options: available.map((type) => ({ id: type.id, name: type.name })),
        },
      ],
    });
    if (!values) {
      return;
    }

    this.api.create(Number(values['accountType'])).subscribe({
      next: () => this.load(),
      error: (err: unknown) => {
        console.error('Failed to add the account number format', err);
      },
    });
  }

  /** Sets or changes a format's prefix, offering only the prefixes its account type allows. */
  async onSetPrefix(format: AccountNumberFormat): Promise<void> {
    const options = this.prefixesFor(format);
    if (options.length === 0) {
      return;
    }

    const values = await this.dialog.prompt({
      title: this.i18n.translate('SYSTEM.SET_PREFIX'),
      message: this.i18n.translate('SYSTEM.SET_PREFIX_PROMPT'),
      fields: [
        {
          name: 'prefixType',
          label: this.i18n.translate('SYSTEM.NUMBER_PREFIX'),
          type: 'select',
          options: options.map((option) => ({ id: option.id, name: option.name })),
        },
      ],
    });
    if (!values) {
      return;
    }

    this.api.setPrefix(format.id, Number(values['prefixType'])).subscribe({
      next: () => this.load(),
      error: (err: unknown) => {
        console.error('Failed to set the account number prefix', err);
      },
    });
  }

  /**
   * Removes a format.
   *
   * Existing account numbers are not rewritten — the format governs what the next one looks
   * like — so the confirmation says that rather than implying the numbers already issued change.
   */
  async onDeleteFormat(format: AccountNumberFormat): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('SYSTEM.DELETE_ACCOUNT_NUMBER_FORMAT'),
      message: this.i18n.translate('SYSTEM.DELETE_ACCOUNT_NUMBER_FORMAT_CONFIRM'),
      details: [{ label: this.i18n.translate('SYSTEM.ACCOUNT_TYPE'), value: format.accountType }],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.api.delete(format.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => {
        console.error('Failed to delete the account number format', err);
      },
    });
  }
}
