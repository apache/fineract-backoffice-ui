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
import { TranslateService } from '@ngx-translate/core';
import {
  MISSING_TRANSLATION_PREFIX,
  ReportingMissingTranslationHandler,
} from './missing-translation.handler';

const LANG = 'en';
const KEY = 'SAVINGS.CONFIRM_UNDO';

describe('ReportingMissingTranslationHandler', () => {
  let handler: ReportingMissingTranslationHandler;
  let warn: ReturnType<typeof vi.spyOn>;

  /**
   * The service a miss came from, in the state the handler asks about: which language is
   * current, and what that language has loaded. `getTranslations` answers `undefined` for a
   * language that has not loaded, whatever its declared type says.
   */
  function serviceWith(catalogue: Record<string, unknown> | undefined): TranslateService {
    return {
      getCurrentLang: () => LANG,
      getTranslations: () => catalogue,
    } as unknown as TranslateService;
  }

  /** A loaded catalogue, which is the state in which a miss means something. */
  const loaded = () => serviceWith({ COMMON: { SAVE: 'Save' } });
  const miss = (key: string, translateService: TranslateService) =>
    handler.handle({ key, translateService });

  beforeEach(() => {
    TestBed.resetTestingModule();
    handler = TestBed.inject(ReportingMissingTranslationHandler);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  /** Callers render whatever comes back, so this is the assertion a user would notice. */
  it('returns the key, leaving what the user sees unchanged', () => {
    expect(miss(KEY, loaded())).toBe(KEY);
  });

  it('reports a key missing from a catalogue that has loaded', () => {
    miss(KEY, loaded());

    expect(warn).toHaveBeenCalledWith(`${MISSING_TRANSLATION_PREFIX} ${KEY}`);
  });

  /**
   * The reason the guard exists. Between first render and the catalogue arriving every key in
   * the application misses; reporting that window would bury the real misses.
   */
  it('stays silent while no catalogue has loaded yet', () => {
    miss(KEY, serviceWith(undefined));

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent when the catalogue loaded empty', () => {
    miss(KEY, serviceWith({}));

    expect(warn).not.toHaveBeenCalled();
  });

  /**
   * The deployment-branding case. `DOCS/CUSTOMIZATION.md` documents
   * `"clients": { "labelKey": "Members" }`, which works precisely because an unresolved key is
   * returned verbatim — so every branded deployment sends its own labels through here.
   */
  it('stays silent for a phrase, which is a deployment override doing its job', () => {
    const service = loaded();
    for (const phrase of ['Members', 'Member Groups', 'Field CRM']) {
      miss(phrase, service);
    }

    expect(warn).not.toHaveBeenCalled();
  });

  it('still returns the phrase, so the override renders', () => {
    expect(miss('Members', loaded())).toBe('Members');
  });

  /**
   * A miss in a template repeats on every change-detection pass. Without the de-duplication one
   * broken binding writes thousands of identical lines.
   */
  it('reports each key once however often it misses', () => {
    const service = loaded();
    for (let i = 0; i < 5; i++) {
      miss(KEY, service);
    }

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
