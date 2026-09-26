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

import { InjectionToken, Type, inject } from '@angular/core';
import { IonicOverlayAdapter } from './ionic-overlay.adapter';

/** Where a toast appears relative to the viewport. */
export type ToastPosition = 'top' | 'bottom';

/** A framework-neutral toast request. */
export interface ToastRequest {
  message: string;
  /** Milliseconds before auto-dismissal. */
  duration: number;
  position: ToastPosition;
  cssClass?: string | string[];
  /** Label for the dismiss button. Omit or pass an empty string for no button. */
  dismissLabel?: string;
}

/** A framework-neutral modal request. */
export interface ModalRequest {
  /** The component rendered inside the overlay. */
  component: Type<unknown>;
  /** Inputs delivered to the component. */
  inputs?: Record<string, unknown>;
  cssClass?: string | string[];
  /**
   * Whether clicking the backdrop or pressing Escape dismisses the modal.
   *
   * Defaults to `true`. `IdleService` sets it `false`: a session-expiry countdown that a
   * stray click can cancel is not a countdown.
   */
  dismissible?: boolean;
}

/**
 * A presented modal, for the callers that need to act on it after it is on screen.
 *
 * Most call sites only want the result and use {@link OverlayAdapter.modal}. `IdleService`
 * needs more: when the session ends for a reason other than the countdown expiring — a 401
 * from another tab, an explicit sign-out — the warning dialog has to come down without the
 * user answering it, which a bare result promise cannot express.
 */
export interface ModalHandle<T> {
  /** Resolves with the dismissal value, or `undefined` when dismissed without one. */
  readonly result: Promise<T | undefined>;
  /** Dismisses the modal. Resolves once it has begun animating out. */
  dismiss(): Promise<void>;
}

/**
 * The overlay capability the application depends on — toasts and modals — stated without
 * reference to the component library that renders them.
 *
 * The application's UI layer is Ionic (see `AGENTS.md`), and 250 components render
 * `<ion-*>` elements. Those are presentational and migrate one component at a time. Ionic's
 * *imperative* surface is different: `ToastController` and `ModalController` are singletons
 * reached from services, they are the part with lifecycle semantics worth testing, and they
 * are the part that a component-library change breaks in ways a template swap does not.
 * Isolating them is what makes `NotificationService`, `DialogService` and `IdleService`
 * testable without `provideIonicTesting()`.
 */
export interface OverlayAdapter {
  /** Dismisses any currently presented popover. Does nothing when none is open. */
  dismissPopovers(): Promise<void>;

  /** Presents a toast and resolves once it has been shown, not once it has dismissed. */
  toast(request: ToastRequest): Promise<void>;

  /**
   * Presents a modal and resolves with the value it was dismissed with, or `undefined`
   * when it was dismissed without one.
   */
  modal<T>(request: ModalRequest): Promise<T | undefined>;

  /**
   * Presents a modal and resolves as soon as it is on screen, with a handle to it.
   *
   * Use {@link modal} unless the caller needs to dismiss the modal itself.
   */
  presentModal<T>(request: ModalRequest): Promise<ModalHandle<T>>;

  /**
   * Dismisses the modal the caller is rendered inside, returning a result to whoever opened it.
   *
   * The counterpart to {@link modal}: that resolves with a value, and this is how the content
   * supplies one. Without it a dialog component has no way to answer its opener except by
   * reaching for the component library directly, which is the boundary this adapter exists to
   * hold — every existing dialog does exactly that, and each is a recorded violation.
   *
   * Distinct from {@link ModalHandle.dismiss}, which is the *opener* closing a modal it holds.
   */
  dismissModal<T>(result?: T): Promise<void>;
}

/**
 * Injection token for the active {@link OverlayAdapter}.
 *
 * Bound to the Ionic implementation by default. The default matters: `ToastController` and
 * `ModalController` are root-provided by Ionic, so before this boundary existed a TestBed
 * rendering a component that shows a toast needed no configuration at all. A token with no
 * default would have made every such spec — and every future one — declare a provider it has
 * no opinion about. Overriding in `app.config.ts` or a TestBed still wins over the default,
 * which is the whole point of naming the seam.
 */
export const OVERLAY = new InjectionToken<OverlayAdapter>('OverlayAdapter', {
  providedIn: 'root',
  factory: () => inject(IonicOverlayAdapter),
});
