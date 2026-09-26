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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateStore } from '@ngx-translate/core';
import {
  MISSING_TRANSLATION_PREFIX,
  ReportingMissingTranslationHandler,
} from './missing-translation.handler';

const LANG = 'en';
const KEY = 'SAVINGS.CONFIRM_UNDO';

describe('ReportingMissingTranslationHandler', () => {
  let store: TranslateStore;
  let handler: ReportingMissingTranslationHandler;
  let warn: ReturnType<typeof vi.spyOn>;

  /** A loaded catalogue, which is the state in which a miss means something. */
  function loadCatalogue(): void {
    store.setCurrentLang(LANG);
    store.setTranslations(LANG, { COMMON: { SAVE: 'Save' } }, false);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [TranslateStore] });
    store = TestBed.inject(TranslateStore);
    handler = TestBed.inject(ReportingMissingTranslationHandler);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  /** Callers render whatever comes back, so this is the assertion a user would notice. */
  it('returns the key, leaving what the user sees unchanged', () => {
    loadCatalogue();
    expect(handler.handle({ key: KEY, translateService: null as never })).toBe(KEY);
  });

  it('reports a key missing from a catalogue that has loaded', () => {
    loadCatalogue();
    handler.handle({ key: KEY, translateService: null as never });

    expect(warn).toHaveBeenCalledWith(`${MISSING_TRANSLATION_PREFIX} ${KEY}`);
  });

  /**
   * The reason the guard exists. Between first render and the catalogue arriving every key in
   * the application misses; reporting that window would bury the real misses.
   */
  it('stays silent while no catalogue has loaded yet', () => {
    store.setCurrentLang(LANG);
    handler.handle({ key: KEY, translateService: null as never });

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent when the catalogue loaded empty', () => {
    store.setCurrentLang(LANG);
    store.setTranslations(LANG, {}, false);
    handler.handle({ key: KEY, translateService: null as never });

    expect(warn).not.toHaveBeenCalled();
  });

  /**
   * A miss in a template repeats on every change-detection pass. Without the de-duplication one
   * broken binding writes thousands of identical lines.
   */
  it('reports each key once however often it misses', () => {
    loadCatalogue();
    for (let i = 0; i < 5; i++) {
      handler.handle({ key: KEY, translateService: null as never });
    }

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
