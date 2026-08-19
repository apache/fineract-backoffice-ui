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

/**
 * Sticky, because `isIconOnly` matches them at a position rather than searching.
 *
 * `<ion-icon>`'s content is a glyph, never text. Angular control flow is structure, not
 * content, and is left behind once the icons inside it are accounted for.
 */
const ICON_OPEN = /<ion-icon(?=[\s/>])/y;
const CONTROL_FLOW = /@(?:if|else|for|empty|switch|case|default)\b[^{]*\{|\}/y;
const WHITESPACE = /\s+/y;

const ICON_CLOSE = '</ion-icon>';
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';

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

/** Index just past `pattern` when it matches at `index`, otherwise -1. */
function skip(pattern, source, index) {
  pattern.lastIndex = index;
  return pattern.test(source) ? pattern.lastIndex : -1;
}

/**
 * True when the button renders icons and nothing a name could be computed from.
 *
 * This walks the content rather than chaining `String.replace` to strip comments and
 * icons out of it. Removing a multi-character delimiter such as `<!--` in a single pass
 * is a shape worth keeping out of the tree even where it happens to be sound, because on
 * input that can nest, one pass leaves behind a delimiter that a second pass would have
 * caught. CodeQL flags it on sight (`js/incomplete-multi-character-sanitization`), and a
 * check that gates other people's builds is a poor place for a pattern a reader has to
 * stop and reason about. Walking is also stricter than the regex it replaces: it ends an
 * icon's opening tag with `endOfOpeningTag`, so a self-closing `<ion-icon>` carrying a `>`
 * inside one of its bindings no longer escapes the check entirely.
 */
function isIconOnly(content) {
  let sawIcon = false;
  let i = 0;

  while (i < content.length) {
    if (content.startsWith(COMMENT_OPEN, i)) {
      const end = content.indexOf(COMMENT_CLOSE, i + COMMENT_OPEN.length);
      i = end === -1 ? content.length : end + COMMENT_CLOSE.length;
      continue;
    }

    if (skip(ICON_OPEN, content, i) !== -1) {
      const tagEnd = endOfOpeningTag(content, i);
      if (tagEnd === -1) return false;

      if (content[tagEnd - 1] === '/') {
        i = tagEnd + 1;
      } else {
        const close = content.indexOf(ICON_CLOSE, tagEnd);
        i = close === -1 ? content.length : close + ICON_CLOSE.length;
      }
      sawIcon = true;
      continue;
    }

    const pastControlFlow = skip(CONTROL_FLOW, content, i);
    if (pastControlFlow !== -1) {
      i = pastControlFlow;
      continue;
    }

    const pastBlank = skip(WHITESPACE, content, i);
    if (pastBlank !== -1) {
      i = pastBlank;
      continue;
    }

    // Anything else is content a name could be computed from.
    return false;
  }

  return sawIcon;
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
