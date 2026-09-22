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

import { Injectable, Injector, inject } from '@angular/core';
import { ModalController, PopoverController, ToastController } from '@ionic/angular/standalone';
// Type-only, and deliberately so: `overlay.adapter.ts` names this class as the token's
// default binding, and a value import back would close a runtime cycle. `import type` is
// erased, so the cycle exists only in the type graph, where it is harmless.
import type { ModalHandle, ModalRequest, OverlayAdapter, ToastRequest } from './overlay.adapter';

/**
 * {@link OverlayAdapter} backed by Ionic's `ToastController` and `ModalController`.
 *
 * Together with `app.config.ts`'s `provideIonicAngular`, this is the only file in the
 * application permitted to import `@ionic/angular` imperative APIs — `eslint.config.js`
 * enforces it. Ionic's overlay lifecycle (create → present → onWillDismiss) is collapsed
 * here into promises the rest of the app can await.
 */
@Injectable({ providedIn: 'root' })
export class IonicOverlayAdapter implements OverlayAdapter {
  private readonly injector = inject(Injector);

  // Resolved per call rather than held as fields. The contract covers toasts and modals
  // together, but Ionic's controllers are provided separately — `ToastController` is
  // available everywhere, `ModalController` only where `provideIonicAngular()` has run.
  // Injecting both eagerly would make a component that merely shows a toast fail to
  // construct in any TestBed that had no reason to configure modals.
  private get toastController(): ToastController {
    return this.injector.get(ToastController);
  }

  private get modalController(): ModalController {
    return this.injector.get(ModalController);
  }

  private get popoverController(): PopoverController {
    return this.injector.get(PopoverController);
  }

  async dismissPopovers(): Promise<void> {
    await this.popoverController.dismiss();
  }

  async toast(request: ToastRequest): Promise<void> {
    const toast = await this.toastController.create({
      message: request.message,
      duration: request.duration,
      position: request.position,
      cssClass: request.cssClass,
      buttons: request.dismissLabel ? [{ text: request.dismissLabel, role: 'cancel' }] : [],
    });

    await toast.present();
  }

  async modal<T>(request: ModalRequest): Promise<T | undefined> {
    const handle = await this.presentModal<T>(request);
    return handle.result;
  }

  async dismissModal<T>(result?: T): Promise<void> {
    // Ionic routes this to the topmost modal, which is the one the calling component is in.
    await this.modalController.dismiss(result);
  }

  async presentModal<T>(request: ModalRequest): Promise<ModalHandle<T>> {
    const modal = await this.modalController.create({
      component: request.component,
      componentProps: request.inputs,
      cssClass: request.cssClass,
      // Ionic splits dismissibility across two flags and defaults both to true. The contract
      // has one, because no caller has ever wanted the backdrop and Escape to disagree.
      backdropDismiss: request.dismissible ?? true,
      keyboardClose: request.dismissible ?? true,
    });

    // `onWillDismiss` rather than `onDidDismiss`: the caller's follow-up work — a navigation,
    // a refetch — should start as the modal begins animating out, not after it has finished.
    //
    // Subscribed *before* `present()` is awaited, which is not a stylistic choice. Ionic sets
    // `presented = true` and starts the enter animation, then resolves `present()` only once
    // that animation has finished; the overlay is dismissible for the whole ~300 ms in between.
    // A confirm clicked inside that window — routine on a loaded machine, where dropped frames
    // make the dialog look settled long before it is — emits `ionModalWillDismiss` while
    // `present()` is still pending. Attaching the listener afterwards misses that event for
    // good, and the promise below never settles: the dialog closes, the caller goes on awaiting
    // a result that will never arrive, and the command it collected is silently never sent.
    const result = modal.onWillDismiss<T>().then(({ data }) => data);

    await modal.present();

    return {
      result,
      dismiss: async () => {
        await modal.dismiss();
      },
    };
  }
}
