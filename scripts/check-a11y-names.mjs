#!/usr/bin/env node
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

/**
 * Verifies that every icon-only `<ion-button>` has an accessible name.
 *
 * A button whose only content is an `<ion-icon>` has nothing to compute a name from: the
 * icon is a font glyph, not text. A screen reader announces the control as "button" and
 * nothing else, so a row of them is a row of identical buttons, including the ones that
 * delete a record.
 *
 * Three things look like they solve this. Two of them do not:
 *
 * - `[appTooltip]`. `TooltipDirective` sets `aria-describedby`. A description is not a
 *   name: it is never consulted by the accessible name computation, it is only present
 *   300ms after hover or focus, and a screen reader user reading in browse mode never
 *   triggers it at all.
 * - `title`. `<ion-button>` renders a native `<button>` into its shadow root, and that
 *   inner element is what carries `role=button`. Ionic forwards `aria-label` to it but not
 *   `title`, so a title names the outer host, which the accessibility tree exposes as
 *   `role=generic`, and the button itself stays anonymous. Read out of Chromium's own
 *   accessibility tree rather than inferred: `title` on the host gives `role=generic
 *   name="Edit"` sitting over `role=button name=""`, while `aria-label` on the same host
 *   gives `role=button name="Edit"`.
 * - An `aria-label` on the `<ion-icon>` itself. This one does work, because
 *   name-from-content descends into children, and the check accepts it.
 *
 * The fix is `[attr.aria-label]` on the button, bound to the translation key that already
 * names the action.
 *
 * Usage: node scripts/check-a11y-names.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'src';
const TAG = 'ion-button';

/** Attributes that name the element outright, static or bound. */
const NAMING_ATTRIBUTE = /(?:\[attr\.)?aria-label(?:ledby)?\]?=|aria-labelledby=/;
/** An `<ion-icon>` element, self-closed or paired. Its content is a glyph, never text. */
const ICON = /<ion-icon\b[^>]*?(?:\/>|>[\s\S]*?<\/ion-icon>)/g;
const COMMENT = /<!--[\s\S]*?-->/g;
/** Angular control flow left behind once the icons inside it are removed. */
const CONTROL_FLOW = /@(?:if|else|for|empty|switch|case|default)\b[^{]*\{|\}/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Generated API client has no templates.
      if (entry === 'api' || entry === 'node_modules') continue;
      out.push(...walk(path));
    } else if (path.endsWith('.ts') || path.endsWith('.html')) {
      if (path.endsWith('.spec.ts')) continue;
      out.push(path);
    }
  }
  return out;
}

/**
 * End index of the opening tag that starts at `start`, tracking quotes.
 *
 * A plain search for `>` is wrong here: binding expressions contain them, and
 * `[disabled]="from > to"` would truncate the tag halfway through its own attributes,
 * hiding every attribute after it, including the aria-label this check looks for.
 */
function endOfOpeningTag(source, start) {
  let quote = null;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

/** Every `<ion-button>` in `source`. Buttons cannot nest, so the first close tag is ours. */
function buttons(source) {
  const found = [];
  const opening = new RegExp(`<${TAG}(?=[\\s/>])`, 'g');

  for (const match of source.matchAll(opening)) {
    const tagEnd = endOfOpeningTag(source, match.index);
    if (tagEnd === -1) continue;

    const openTag = source.slice(match.index, tagEnd + 1);
    if (openTag.endsWith('/>')) {
      found.push({ openTag, content: '', index: match.index });
      continue;
    }

    const close = source.indexOf(`</${TAG}>`, tagEnd);
    if (close === -1) continue;
    found.push({ openTag, content: source.slice(tagEnd + 1, close), index: match.index });
  }
  return found;
}

/** True when the button renders icons and nothing a name could be computed from. */
function isIconOnly(content) {
  ICON.lastIndex = 0;
  if (!ICON.test(content)) return false;
  ICON.lastIndex = 0;

  return content.replace(COMMENT, '').replace(ICON, '').replace(CONTROL_FLOW, '').trim() === '';
}

const problems = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');

  for (const { openTag, content, index } of buttons(source)) {
    if (!isIconOnly(content)) continue;
    // A name on the icon counts: name-from-content descends into children.
    if (NAMING_ATTRIBUTE.test(openTag) || NAMING_ATTRIBUTE.test(content)) continue;

    problems.push({ file: relative('.', file), line: source.slice(0, index).split('\n').length });
  }
}

if (problems.length > 0) {
  console.error('Icon-only <ion-button> with no accessible name. A screen reader announces');
  console.error('these as "button" and nothing else:\n');
  for (const { file, line } of problems) {
    console.error(`  ${file}:${line}`);
  }
  console.error(
    '\nAdd [attr.aria-label] to each, bound to the translation key that already names\n' +
      'the action:  [attr.aria-label]="\'COMMON.EDIT\' | translate"\n\n' +
      'Neither [appTooltip] nor title satisfies this. appTooltip sets aria-describedby,\n' +
      'which is a description rather than a name; title names the outer host element and\n' +
      "not the button Ionic renders into its shadow root. See this script's header.",
  );
  process.exit(1);
}

console.log('Every icon-only <ion-button> has an accessible name.');
