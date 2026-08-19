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

'use strict';

/**
 * Tests for the local cognitive-complexity rule.
 *
 *   node --test eslint-rules/
 *
 * These are worth more than the usual "does it load" coverage. The rule replaces one that came
 * from a removed dependency, and the thing that would go wrong quietly is a scoring change —
 * a rule that still runs, still reports, and has silently become stricter or laxer than the one
 * it replaced. So most cases below assert an exact score at a threshold of one less than it, which
 * pins the arithmetic rather than the fact that something was reported.
 */

const test = require('node:test');
const assert = require('node:assert');
const { RuleTester } = require('eslint');
const rule = require('./cognitive-complexity.js');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

/**
 * The report text, rendered.
 *
 * Asserted in full rather than through RuleTester's `data`, which requires every placeholder in
 * the template to be supplied and so turns a check of one value into a restatement of the whole
 * message anyway.
 */
function message(name, complexity, threshold) {
  return (
    `Cognitive complexity of ${name} is ${complexity}, above the maximum of ${threshold}. ` +
    'Pull the nested branches out into named functions rather than raising the limit.'
  );
}

/** Asserts a snippet scores exactly `expected`, by running it at both sides of the boundary. */
function scores(name, code, expected, functionLabel = "'f'") {
  test(`${name} scores ${expected}`, () => {
    // At a threshold of `expected` the function is within budget and must not report.
    ruleTester.run('cognitive-complexity', rule, {
      valid: [{ code, options: [{ threshold: expected }] }],
      invalid: [],
    });
    // One lower, and it must — with the score named in the message.
    if (expected > 0) {
      ruleTester.run('cognitive-complexity', rule, {
        valid: [],
        invalid: [
          {
            code,
            options: [{ threshold: expected - 1 }],
            errors: [{ message: message(functionLabel, expected, expected - 1) }],
          },
        ],
      });
    }
  });
}

// --- the flat increments -------------------------------------------------------------------

scores('an empty function', 'function f() {}', 0);
scores('a single if', 'function f() { if (a) { b(); } }', 1);
scores('if/else', 'function f() { if (a) { b(); } else { c(); } }', 2);
scores('a ternary', 'function f() { return a ? b : c; }', 1);
scores('a for loop', 'function f() { for (const x of xs) { g(x); } }', 1);
scores('a while loop', 'function f() { while (a) { b(); } }', 1);
scores('a do/while loop', 'function f() { do { b(); } while (a); }', 1);
scores('a catch clause', 'function f() { try { a(); } catch (e) { b(); } }', 1);

scores(
  'a switch, regardless of how many cases it has',
  'function f() { switch (x) { case 1: a(); break; case 2: b(); break; case 3: c(); break; default: d(); } }',
  1,
);

// --- if/else-if chains stay flat -----------------------------------------------------------

scores(
  'an if/else-if/else chain costs one per branch and does not nest',
  'function f() { if (a) { x(); } else if (b) { y(); } else if (c) { z(); } else { w(); } }',
  4,
);

// --- nesting is where the metric differs from cyclomatic complexity -------------------------

scores(
  'two ifs side by side',
  'function f() { if (a) { x(); } if (b) { y(); } }',
  2, // 1 + 1
);

scores(
  'two ifs nested cost more than two side by side',
  'function f() { if (a) { if (b) { y(); } } }',
  3, // 1 + (1 + 1)
);

scores(
  'three levels of nesting',
  'function f() { for (const x of xs) { if (a) { while (b) { y(); } } } }',
  6, // 1 + (1+1) + (1+2)
);

// --- logical operator sequences ------------------------------------------------------------

scores('a run of && counts once', 'function f() { return a && b && c && d; }', 1);
scores('a change of operator starts a new run', 'function f() { return a && b || c; }', 2);
scores(
  'a condition inside an if pays for both',
  'function f() { if (a && b) { x(); } }',
  2, // the if, plus one && sequence
);

// `??` states a default rather than branching, and is not counted. This is pinned because
// counting it made an early draft stricter than the rule it replaces: a real template handler
// in loan-product-form.component.ts holds 23 `??` defaults and no other branching.
scores('a chain of nullish defaults costs nothing', 'function f() { return a ?? b ?? c ?? d; }', 0);
scores(
  'nullish defaults do not inflate a function that does branch',
  'function f() { if (a) { use(b ?? [], c ?? {}, d ?? 0); } }',
  1,
);
scores(
  'mixing ?? with && still counts only the &&',
  'function f() { return (a ?? b) && (c ?? d); }',
  1,
);

// --- recursion and labelled jumps -----------------------------------------------------------

scores('direct recursion', 'function f() { f(); }', 1);
scores('a method recursing through this', 'const o = { load() { this.load(); } };', 1, "'load'");
scores(
  'a labelled break',
  'function f() { outer: for (const x of xs) { for (const y of ys) { break outer; } } }',
  1 + (1 + 1) + 1,
);

// --- nested functions score separately ------------------------------------------------------

test('a nested function is scored on its own, not charged to its parent', () => {
  // The inner arrow is 3 on its own (if + nested if). The outer function holds only the `if`
  // around it, so it must not be reported at a threshold of 1.
  ruleTester.run('cognitive-complexity', rule, {
    valid: [],
    invalid: [
      {
        code: `
          function outer() {
            if (ready) {
              items.forEach((item) => {
                if (item.a) {
                  if (item.b) { use(item); }
                }
              });
            }
          }
        `,
        options: [{ threshold: 2 }],
        // Only the arrow exceeds 2; `outer` scores 1 and stays silent.
        errors: [{ message: message('this function', 3, 2) }],
      },
    ],
  });
});

// --- the default threshold ------------------------------------------------------------------

test('the default threshold is 15, matching what was enforced before', () => {
  const under = `function f() { ${'if (a) { x(); } '.repeat(15)} }`;
  const over = `function f() { ${'if (a) { x(); } '.repeat(16)} }`;
  ruleTester.run('cognitive-complexity', rule, {
    valid: [{ code: under }],
    invalid: [
      {
        code: over,
        errors: [{ message: message("'f'", 16, 15) }],
      },
    ],
  });
});

test('the message names the function so the report is actionable', () => {
  ruleTester.run('cognitive-complexity', rule, {
    valid: [],
    invalid: [
      {
        code: 'function loadEverything() { if (a) { if (b) { c(); } } }',
        options: [{ threshold: 2 }],
        errors: [{ message: message("'loadEverything'", 3, 2) }],
      },
    ],
  });
});

test('the rule exports a schema so a bad option fails loudly', () => {
  assert.ok(Array.isArray(rule.meta.schema), 'meta.schema must be an array');
  assert.strictEqual(rule.meta.schema[0].additionalProperties, false);
});
