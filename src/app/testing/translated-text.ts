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

import en from '../../assets/i18n/en.json';

/** Follows a dotted translation key down the English catalogue. */
function englishFor(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );
}

/**
 * The text each element holds directly, with whitespace collapsed.
 *
 * Direct text only, so `<ion-button><ion-icon/> Add Debit</ion-button>` yields "Add Debit" and a
 * heading that merely *contains* the phrase inside a longer sentence does not. A literal written
 * into a template is always a text node of its own element; a phrase that happens to be part of
 * other copy is not the defect this looks for.
 */
function typedText(root: Element): Set<string> {
  const found = new Set<string>();
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    const own = Array.from(element.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent ?? '')
      .join(' ')
      .replaceAll(/\s+/g, ' ')
      .trim();
    if (own) found.add(own);
  }
  return found;
}

/**
 * Proves that text on screen was looked up rather than typed into the template.
 *
 * A heading written as `<h3>Debit Details</h3>` renders correctly in English and stays English in
 * every other language, and nothing reports it: no key is referenced, so no key can be missing.
 * The only place it shows is a render in which the catalogue is not the English one. A spec that
 * leaves the translation library unconfigured, or binds the fake adapter, gets exactly that —
 * every lookup echoes its key — so a looked-up label appears as its key and a typed one appears
 * as English.
 *
 * For each key this asserts that
 *
 * 1. the key is defined in `en.json`, so the spec cannot pass on a key that would render blank;
 * 2. the key was rendered, so the template really asks for it; and
 * 3. the English the key stands for was not typed as an element's own text, which is what a
 *    hard-coded literal looks like.
 *
 * Reading the English from `en.json` rather than restating it in the spec keeps the two from
 * drifting: rewording a string cannot turn this into a test of the old wording.
 */
export function expectLookedUp(root: Element, keys: readonly string[]): void {
  const text = root.textContent ?? '';
  const typed = typedText(root);
  for (const key of keys) {
    const english = englishFor(key);
    expect(english, `${key} is not defined in en.json`).toEqual(expect.any(String));
    expect(text, `${key} was never rendered`).toContain(key);
    expect(
      typed.has(english as string),
      `"${english as string}" is typed into the template; use ${key}`,
    ).toBe(false);
  }
}
