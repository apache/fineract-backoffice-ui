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

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController, PopoverController } from '@ionic/angular/standalone';

import { IonicOverlayAdapter } from './ionic-overlay.adapter';

@Component({ standalone: true, template: '' })
class DialogStubComponent {}

/** Sentinel for "the promise under test never settled". */
const NEVER_SETTLED = Symbol('never settled');

/**
 * A modal with Ionic's presentation timing, which is what this spec is about.
 *
 * `present()` marks the overlay presented — and therefore dismissible — immediately, then
 * resolves only once the enter animation has finished. `onWillDismiss()` is one-shot, so a
 * listener attached after the dismissal has already happened never fires. Both match
 * `@ionic/core`'s `utils/overlays.ts`.
 */
class FakeModal {
  presented = false;

  private readonly willDismissListeners: ((detail: { data?: unknown }) => void)[] = [];
  private endAnimation!: () => void;
  private readonly animation = new Promise<void>((resolve) => (this.endAnimation = resolve));
  private announcePresentCalled!: () => void;
  /** Resolves as soon as `present()` has started, i.e. mid-animation. */
  readonly presenting = new Promise<void>((resolve) => (this.announcePresentCalled = resolve));

  async present(): Promise<void> {
    this.presented = true;
    this.announcePresentCalled();
    await this.animation;
  }

  onWillDismiss<T>(): Promise<{ data?: T }> {
    return new Promise<{ data?: T }>((resolve) => {
      this.willDismissListeners.push(resolve as (detail: { data?: unknown }) => void);
    });
  }

  async dismiss(data?: unknown): Promise<boolean> {
    if (!this.presented) return false;
    // Splicing rather than iterating in place: a one-shot listener fires once and is gone,
    // so a listener registered later must not receive this dismissal.
    this.willDismissListeners.splice(0).forEach((listener) => listener({ data }));
    return true;
  }

  finishPresenting(): void {
    this.endAnimation();
  }
}

/** Resolves with the promise's value, or with {@link NEVER_SETTLED} if it stays pending. */
function settledOrNot<T>(promise: Promise<T>): Promise<T | symbol> {
  return Promise.race([
    promise,
    new Promise<symbol>((resolve) => setTimeout(() => resolve(NEVER_SETTLED), 50)),
  ]);
}

describe('IonicOverlayAdapter', () => {
  let modal: FakeModal;
  let adapter: IonicOverlayAdapter;
  let dismissPopover: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    modal = new FakeModal();
    dismissPopover = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ModalController, useValue: { create: () => Promise.resolve(modal) } },
        { provide: PopoverController, useValue: { dismiss: dismissPopover } },
      ],
    });
    adapter = TestBed.inject(IonicOverlayAdapter);
  });

  it('dismisses the active popover', async () => {
    await adapter.dismissPopovers();

    expect(dismissPopover).toHaveBeenCalledOnce();
  });

  /**
   * The regression this guards: the dismissal listener used to be attached after
   * `await modal.present()`, which resolves only once the enter animation is over. A confirm
   * clicked during that window dismissed the dialog before anything was listening, so the
   * caller awaited a result that never arrived and the command the dialog had collected was
   * never sent — the screen simply did nothing. It reproduced on CI, where dropped frames make
   * a dialog look settled while it is still animating, and not on a fast machine.
   */
  it('delivers the result of a dismissal that happens while the modal is still presenting', async () => {
    const handlePromise = adapter.presentModal<{ confirmed: boolean }>({
      component: DialogStubComponent,
    });

    await modal.presenting;
    await modal.dismiss({ confirmed: true });
    modal.finishPresenting();

    const handle = await handlePromise;
    expect(await settledOrNot(handle.result)).toEqual({ confirmed: true });
  });

  it('delivers the result of a dismissal after the modal has finished presenting', async () => {
    const handlePromise = adapter.presentModal<{ confirmed: boolean }>({
      component: DialogStubComponent,
    });

    await modal.presenting;
    modal.finishPresenting();
    const handle = await handlePromise;
    await modal.dismiss({ confirmed: false });

    expect(await settledOrNot(handle.result)).toEqual({ confirmed: false });
  });

  it('resolves undefined when the modal is dismissed without a value', async () => {
    const handlePromise = adapter.presentModal({ component: DialogStubComponent });

    await modal.presenting;
    modal.finishPresenting();
    const handle = await handlePromise;
    await modal.dismiss();

    expect(await settledOrNot(handle.result)).toBeUndefined();
  });
});
