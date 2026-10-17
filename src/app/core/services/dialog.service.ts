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

import { Injectable, Type, inject } from '@angular/core';
import { I18N, ModalHandle, OVERLAY } from '../adapters';
import type {
  ConfirmDialogData,
  DialogField,
  DialogFieldOption,
  DialogValues,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

export type { ConfirmDialogData };
export type { DialogField, DialogFieldOption, DialogValues };

/** Component constructor accepted by {@link DialogService.open}. */
type ComponentRef = new (...args: never[]) => unknown;

/** Presentation options for {@link DialogService.open}. */
export interface DialogOptions {
  cssClass?: string | string[];
  /**
   * Whether the backdrop and Escape dismiss the dialog. Defaults to `true`.
   *
   * `IdleService` passes `false`: a session-expiry countdown a stray click can cancel is
   * not a countdown.
   */
  dismissible?: boolean;
}

/**
 * Application-wide modal dialogs.
 *
 * Goes through {@link OVERLAY} so call sites deal in promises of results rather than
 * controller lifecycles, and so confirmations share one implementation.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly overlay = inject(OVERLAY);
  private readonly i18n = inject(I18N);

  /**
   * Opens a component as a modal and resolves with the value it was dismissed with,
   * or `undefined` if it was dismissed without one (backdrop click, escape).
   */
  open<T>(
    component: ComponentRef,
    data?: Record<string, unknown>,
    options: DialogOptions = {},
  ): Promise<T | undefined> {
    return this.overlay.modal<T>(this.request(component, data, options));
  }

  /**
   * Opens a dialog and resolves once it is on screen, with a handle for dismissing it.
   *
   * Use {@link open} unless the caller has to take the dialog down itself.
   */
  present<T>(
    component: ComponentRef,
    data?: Record<string, unknown>,
    options: DialogOptions = {},
  ): Promise<ModalHandle<T>> {
    return this.overlay.presentModal<T>(this.request(component, data, options));
  }

  private request(
    component: ComponentRef,
    data?: Record<string, unknown>,
    options: DialogOptions = {},
  ) {
    // `[x].flat()` normalises both accepted shapes — a single class or an array.
    const callerClasses = options.cssClass ? [options.cssClass].flat() : [];

    return {
      component: component as Type<unknown>,
      inputs: data,
      // Every dialog gets `app-dialog`, which is what gives its body a scroll
      // container — see src/styles/_dialogs.scss. Without it a dialog taller than
      // the viewport puts its own action buttons out of reach.
      cssClass: ['app-dialog', ...callerClasses],
      dismissible: options.dismissible,
    };
  }

  /**
   * Opens a confirmation dialog and resolves `true` only if the user explicitly confirmed.
   *
   * Loaded lazily so that the confirm dialog component does not pull the whole shared
   * component barrel into every consumer's bundle.
   */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    const { ConfirmDialogComponent } =
      await import('../../shared/components/confirm-dialog/confirm-dialog.component');

    const result = await this.open<boolean>(ConfirmDialogComponent as ComponentRef, {
      data: {
        confirmText: this.i18n.translate('COMMON.CONFIRM'),
        cancelText: this.i18n.translate('COMMON.CANCEL'),
        ...data,
      },
    });

    return result === true;
  }

  /**
   * Opens a confirmation that collects a few values first, and resolves with them.
   *
   * Resolves `undefined` if the user cancelled or dismissed, which is distinguishable from an
   * empty answer: the dialog will not confirm while a required field is blank.
   *
   * For the short forms that belong to a row action rather than to a screen — pay a charge,
   * waive one, adjust one. See `ConfirmDialogData.fields` for why they live in the confirm
   * dialog rather than in six components of their own.
   */
  async prompt(data: ConfirmDialogData): Promise<DialogValues | undefined> {
    const { ConfirmDialogComponent } =
      await import('../../shared/components/confirm-dialog/confirm-dialog.component');

    const result = await this.open<DialogValues | boolean>(ConfirmDialogComponent as ComponentRef, {
      data: {
        confirmText: this.i18n.translate('COMMON.CONFIRM'),
        cancelText: this.i18n.translate('COMMON.CANCEL'),
        ...data,
      },
    });

    // A cancel resolves `false` and a dismissal `undefined`; only a record is an answer.
    return typeof result === 'object' && result !== null ? result : undefined;
  }
}
