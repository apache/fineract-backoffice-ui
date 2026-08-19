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

import { Provider, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  DOWNLOAD,
  DownloadAdapter,
  I18N,
  I18nAdapter,
  ModalHandle,
  ModalRequest,
  OVERLAY,
  OverlayAdapter,
  STORAGE,
  STORAGE_KEYS,
  StorageAdapter,
  StorageKey,
  StorageScope,
  ToastRequest,
  TranslateParams,
} from '../core/adapters';

/**
 * Test doubles for the adapter boundary.
 *
 * A TestBed that provides these needs neither `provideIonicTesting()` nor a translation
 * catalogue: `NotificationService`, `DialogService` and `IdleService` see only the contracts,
 * so a test can assert on the *request* they made rather than on the DOM some library built
 * from it. That is the concrete return on the boundary — before it, asserting that the
 * inactivity dialog is non-dismissable meant reaching into `ModalController.create`'s
 * arguments and knowing that Ionic spells it `backdropDismiss`.
 */

/** Recording {@link OverlayAdapter}. */
export class FakeOverlayAdapter implements OverlayAdapter {
  /** Every toast requested, in order. */
  readonly toasts: ToastRequest[] = [];
  /** Every modal requested, in order. */
  readonly modals: ModalRequest[] = [];

  /** Value the next modal resolves with. Set before the call under test. */
  nextModalResult: unknown = undefined;

  /** Set when a modal opened via `presentModal` was dismissed through its handle. */
  dismissed = false;

  /**
   * Results passed to `dismissModal`, in order.
   *
   * Recorded rather than merely flagged: a dialog component's whole contribution is the value it
   * hands back, so a spec asserting on that value is asserting the thing that matters.
   */
  readonly dismissals: unknown[] = [];

  async toast(request: ToastRequest): Promise<void> {
    this.toasts.push(request);
  }

  async modal<T>(request: ModalRequest): Promise<T | undefined> {
    const handle = await this.presentModal<T>(request);
    return handle.result;
  }

  async dismissModal<T>(result?: T): Promise<void> {
    this.dismissals.push(result);
  }

  async presentModal<T>(request: ModalRequest): Promise<ModalHandle<T>> {
    this.modals.push(request);
    return {
      result: Promise.resolve(this.nextModalResult as T | undefined),
      dismiss: async () => {
        this.dismissed = true;
      },
    };
  }

  /** The most recent modal request, for assertions that read better than `modals.at(-1)`. */
  get lastModal(): ModalRequest | undefined {
    return this.modals.at(-1);
  }

  /** The most recent toast request. */
  get lastToast(): ToastRequest | undefined {
    return this.toasts.at(-1);
  }
}

/**
 * {@link I18nAdapter} that echoes keys back.
 *
 * Echoing rather than returning a fixed string keeps assertions legible — a test that expects
 * `COMMON.CLOSE` says which key it expects, which is the thing worth pinning.
 */
export class FakeI18nAdapter implements I18nAdapter {
  private readonly lang = signal('en');

  readonly currentLang = this.lang.asReadonly();
  readonly availableLangs = signal<readonly string[]>(['en']).asReadonly();

  /** Keys with an entry here resolve to it; everything else echoes. */
  readonly catalogue = new Map<string, string>();

  /**
   * Echoes the key, or the catalogue entry, with `{{param}}` placeholders filled in.
   *
   * The interpolation is not decoration. Without it a string assembled from parameters — the
   * permission a control is missing, a count, a name — resolves to the bare key here, so a
   * spec asserting on the assembled text can only ever assert that a key was used. That makes
   * the composition itself untestable, which is the half most likely to be wrong.
   */
  translate(key: string, params?: TranslateParams): string {
    const template = this.catalogue.get(key) ?? key;
    if (!params) return template;
    return template.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }

  translateAsync(key: string, params?: TranslateParams): Observable<string> {
    return of(this.translate(key, params));
  }

  use(lang: string): Observable<void> {
    this.lang.set(lang);
    return of(undefined);
  }

  registerLangs(): void {
    /* nothing to record — no test has needed the registered set */
  }

  setFallbackLang(): void {
    /* nothing to record */
  }

  detectBrowserLang(): string | undefined {
    return undefined;
  }

  setTranslation(): void {
    /* nothing to record */
  }
}

/**
 * In-memory {@link StorageAdapter}.
 *
 * Replaces the `spyOn(localStorage, 'setItem')` pattern the storage specs used, which asserted
 * on the browser API rather than on what the service meant, and left real entries behind on
 * the karma origin when a spy was forgotten.
 */
export class FakeStorageAdapter implements StorageAdapter {
  readonly values = new Map<StorageKey, string>();

  readRaw(key: StorageKey): string | null {
    return this.values.get(key) ?? null;
  }

  read<T>(key: StorageKey, fallback: T): T {
    const raw = this.readRaw(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write(key: StorageKey, value: unknown): void {
    this.writeRaw(key, JSON.stringify(value));
  }

  writeRaw(key: StorageKey, value: string): void {
    this.values.set(key, value);
  }

  remove(key: StorageKey): void {
    this.values.delete(key);
  }

  clearScope(scope: StorageScope): void {
    for (const [name, entry] of Object.entries(STORAGE_KEYS)) {
      if (entry.scope === scope) this.values.delete(name as StorageKey);
    }
  }
}

/** Recording {@link DownloadAdapter} — nothing reaches the filesystem. */
export class FakeDownloadAdapter implements DownloadAdapter {
  readonly saved: { filename: string; content: Blob }[] = [];

  save(content: Blob, filename: string): void {
    this.saved.push({ content, filename });
  }

  saveText(text: string, filename: string, mimeType = 'text/plain;charset=utf-8;'): void {
    this.save(new Blob([text], { type: mimeType }), filename);
  }

  get lastSaved() {
    return this.saved.at(-1);
  }
}

/** Every adapter token bound to a fake, plus handles for asserting on them. */
export function provideFakeAdapters(): {
  providers: Provider[];
  overlay: FakeOverlayAdapter;
  i18n: FakeI18nAdapter;
  storage: FakeStorageAdapter;
  download: FakeDownloadAdapter;
} {
  const overlay = new FakeOverlayAdapter();
  const i18n = new FakeI18nAdapter();
  const storage = new FakeStorageAdapter();
  const download = new FakeDownloadAdapter();

  return {
    providers: [
      { provide: OVERLAY, useValue: overlay },
      { provide: I18N, useValue: i18n },
      { provide: STORAGE, useValue: storage },
      { provide: DOWNLOAD, useValue: download },
    ],
    overlay,
    i18n,
    storage,
    download,
  };
}
