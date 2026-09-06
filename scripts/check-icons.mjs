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
 * Verifies that every ionicon referenced in a template is registered in
 * `src/app/core/icons.ts`.
 *
 * Ionic renders an unregistered <ion-icon name="..."> as blank space with no error, so this
 * check exists to turn a silent visual bug into a build failure.
 *
 * Usage: node scripts/check-icons.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'src';
const REGISTRY = 'src/app/core/icons.ts';
const NAVIGATION_CONFIG = 'src/app/core/services/navigation-config.service.ts';

/** Static `name="foo-outline"` on an ion-icon. */
const STATIC_ICON = /<ion-icon\b[^>]*?\bname="([a-z0-9-]+)"/g;
/** Bound `[name]="cond ? 'a-outline' : 'b-outline'"` — collect every quoted literal. */
const BOUND_ICON = /<ion-icon\b[^>]*?\[name\]="([^"]*)"/g;
const QUOTED = /'([a-z0-9-]+)'/g;
/** Operands of a comparison are test values, not icon names: `direction === 'asc' ? ... : ...`. */
const COMPARISON_OPERAND = /(?:===|!==|==|!=)\s*'[^']*'/g;
/** Literal icon names and hoisted icon constants in the application navigation config. */
const NAV_ICON = /\bicon:\s*'([a-z0-9-]+)'/g;
const NAV_ICON_CONSTANT = /\bconst\s+ICON_[A-Z0-9_]+\s*=\s*'([a-z0-9-]+)'/g;

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

function registeredIcons() {
  const source = readFileSync(REGISTRY, 'utf8');
  const body = source.match(/export const APP_ICONS[^{]*\{([\s\S]*?)\n\};/);
  if (!body) {
    console.error(`Could not find the APP_ICONS map in ${REGISTRY}.`);
    process.exit(2);
  }
  return new Set([...body[1].matchAll(/'([a-z0-9-]+)':/g)].map((m) => m[1]));
}

const registered = registeredIcons();
const problems = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const used = new Set();

  for (const [, name] of source.matchAll(STATIC_ICON)) used.add(name);
  for (const [, expression] of source.matchAll(BOUND_ICON)) {
    const branches = expression.replace(COMPARISON_OPERAND, '');
    for (const [, name] of branches.matchAll(QUOTED)) used.add(name);
  }
  if (file === NAVIGATION_CONFIG) {
    for (const [, name] of source.matchAll(NAV_ICON)) used.add(name);
    for (const [, name] of source.matchAll(NAV_ICON_CONSTANT)) used.add(name);
  }

  for (const name of used) {
    if (!registered.has(name)) {
      problems.push({ file: relative('.', file), name });
    }
  }
}

if (problems.length > 0) {
  console.error('Unregistered ionicons found. These render as blank space at runtime:\n');
  for (const { file, name } of problems) {
    console.error(`  ${file}: "${name}"`);
  }
  console.error(
    `\nAdd each icon to APP_ICONS in ${REGISTRY}, importing it from 'ionicons/icons'.\n` +
      'Names are kebab-case in templates and camelCase in the import.',
  );
  process.exit(1);
}

console.log(`All ion-icon names are registered (${registered.size} icons in the registry).`);
