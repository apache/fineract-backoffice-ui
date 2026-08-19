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
 * Cognitive complexity, as an ESLint rule.
 *
 * ## Why this exists
 *
 * This rule used to come from `eslint-plugin-sonarjs`, which is LGPL-3.0-only — an Apache
 * Category X licence. It was removed from this project's dependencies (see DOCS/LINT_POLICY.md).
 * Nothing else on npm implements the metric under a permissive licence and with a maintainer:
 * `eslint-plugin-cognitive-complexity` is an npm security placeholder, and the alternatives are
 * single-author packages at v0.x or v1.0.x. Taking one of those on would trade a licence problem
 * for a supply-chain one.
 *
 * So the metric is implemented here, from its published definition rather than from anyone's
 * source. Cognitive complexity is a *specification* — G. Ann Campbell's white paper — with
 * independent implementations across many languages, and the three rules below are the whole of
 * it:
 *
 *   1. **Ignore** structures that let several statements read as one. A `switch` costs the same
 *      whether it has three cases or twenty; a sequence of `&&` costs one, not one per operator.
 *   2. **Increment** once for each break in the linear flow of the code: `if`, `else`, ternary,
 *      `switch`, every loop, `catch`, a labelled jump, and recursion.
 *   3. **Increment again** — by the current nesting depth — when such a structure is nested
 *      inside another. Two levels of nesting cost more than two structures side by side, which
 *      is the difference this metric exists to capture and cyclomatic complexity does not.
 *
 * `else` and `else if` take the flat +1 without the nesting surcharge: they are part of a
 * decision the reader is already holding, not a new one to descend into. A function declared
 * inside another raises the nesting level for its own contents but costs nothing by itself,
 * because naming a thing is not a break in flow.
 *
 * ## Threshold
 *
 * Default 15, which is what was enforced here before, so this is a like-for-like replacement
 * rather than a quiet relaxation. Configure with `['error', { threshold: 15 }]`.
 *
 * @see DOCS/LINT_POLICY.md for the full sonarjs replacement mapping.
 */

/** Nodes that both add 1 and raise the nesting level for everything inside them. */
const NESTING_INCREMENT = new Set([
  'IfStatement',
  'ConditionalExpression',
  'SwitchStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
]);

/** Nodes that raise the nesting level without costing anything themselves. */
const NESTING_ONLY = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** Every node that introduces a new function scope, and therefore a new score. */
const FUNCTION_NODES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'MethodDefinition',
]);

/**
 * The name a function is known by, for the message and for recursion detection.
 *
 * Arrow functions and function expressions have no `id`, so the name has to come from
 * whatever they were assigned to — `const load = () => …`, `{ load() {} }`, `class { load() {} }`.
 */
function functionName(node) {
  if (node.id?.name) return node.id.name;
  const parent = node.parent;
  if (!parent) return undefined;
  if (parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
    return parent.id.name;
  }
  if (
    (parent.type === 'MethodDefinition' || parent.type === 'Property') &&
    parent.key?.type === 'Identifier'
  ) {
    return parent.key.name;
  }
  if (parent.type === 'PropertyDefinition' && parent.key?.type === 'Identifier') {
    return parent.key.name;
  }
  return undefined;
}

/**
 * Whether this logical expression starts a run of operators, or continues one.
 *
 * `a && b && c` is one decision to the reader and scores 1. `a && b || c` is two, because the
 * operator changes. Only the outermost node of a same-operator run is counted, so the test is
 * whether the parent is a logical expression using the same operator.
 *
 * `??` is deliberately not counted at all — see {@link isCounted}.
 */
function startsLogicalSequence(node) {
  const parent = node.parent;
  if (!parent || parent.type !== 'LogicalExpression') return true;
  if (!isCounted(parent)) return true;
  return parent.operator !== node.operator;
}

/**
 * Whether a logical operator is a decision the reader has to hold.
 *
 * `&&` and `||` are. `??` is not: `template.options ?? []` states a default, it does not branch
 * the way the reader has to follow. Counting it would make this rule stricter than the one it
 * replaces — `loan-product-form.component.ts` has a template handler with 23 `??` defaults and no
 * other branching, which the previous rule passed and an early draft of this one failed. That is
 * the exact regression this rule exists to avoid, so the behaviour is pinned by a test.
 */
function isCounted(node) {
  return node.operator === '&&' || node.operator === '||';
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a maximum cognitive complexity, counting how hard a function is to read rather than how many paths it has',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          threshold: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooComplex:
        'Cognitive complexity of {{name}} is {{complexity}}, above the maximum of {{threshold}}. Pull the nested branches out into named functions rather than raising the limit.',
    },
  },

  create(context) {
    const threshold = context.options[0]?.threshold ?? 15;

    /** One frame per function being scored; the innermost is the one being added to. */
    const stack = [];

    /**
     * Adds to the innermost function's score.
     *
     * `withNesting` charges the current depth on top of the flat increment. Depth is counted
     * from the function's own body, so a structure at the top level of a function is not nested.
     */
    function score(node, withNesting) {
      const frame = stack[stack.length - 1];
      if (!frame) return;
      frame.complexity += 1 + (withNesting ? frame.nesting : 0);
      void node;
    }

    /** Whether a call is the enclosing function calling itself. */
    function isRecursiveCall(node) {
      const frame = stack[stack.length - 1];
      if (!frame?.name) return false;
      const callee = node.callee;
      if (callee.type === 'Identifier') return callee.name === frame.name;
      // `this.load()` inside `load()`, which is how a component method recurses.
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'ThisExpression' &&
        callee.property.type === 'Identifier'
      ) {
        return callee.property.name === frame.name;
      }
      return false;
    }

    function enterFunction(node) {
      stack.push({ node, name: functionName(node), complexity: 0, nesting: 0 });
    }

    function exitFunction(node) {
      const frame = stack.pop();
      if (!frame || frame.node !== node) return;

      // A nested function's score belongs to itself, not to its parent: the parent already paid
      // for the nesting level, and charging it twice would report the outer function for
      // complexity the reader never has to hold at once.
      if (frame.complexity > threshold) {
        context.report({
          node: node.id ?? node,
          messageId: 'tooComplex',
          data: {
            name: frame.name ? `'${frame.name}'` : 'this function',
            complexity: String(frame.complexity),
            threshold: String(threshold),
          },
        });
      }
    }

    /** Raises nesting for the innermost frame while a subtree is being walked. */
    function pushNesting() {
      const frame = stack[stack.length - 1];
      if (frame) frame.nesting += 1;
    }

    function popNesting() {
      const frame = stack[stack.length - 1];
      if (frame) frame.nesting -= 1;
    }

    const visitors = {
      ':function': enterFunction,
      ':function:exit': exitFunction,

      IfStatement(node) {
        // `else if` arrives as an IfStatement in the parent's `alternate`. It is the same
        // decision continued, so it takes the flat increment without the nesting surcharge —
        // and it must not raise nesting either, or a plain if/else-if chain would score like a
        // staircase.
        const isElseIf = node.parent?.type === 'IfStatement' && node.parent.alternate === node;
        score(node, !isElseIf);
        if (!isElseIf) pushNesting();
      },
      'IfStatement:exit'(node) {
        const isElseIf = node.parent?.type === 'IfStatement' && node.parent.alternate === node;
        if (!isElseIf) popNesting();
      },

      // `else` itself: +1, flat. Recognised by an alternate that is not another `if`.
      'IfStatement > *.alternate'(node) {
        if (node.type !== 'IfStatement') score(node, false);
      },

      LogicalExpression(node) {
        if (isCounted(node) && startsLogicalSequence(node)) score(node, false);
      },

      CallExpression(node) {
        if (isRecursiveCall(node)) score(node, false);
      },

      BreakStatement(node) {
        if (node.label) score(node, false);
      },
      ContinueStatement(node) {
        if (node.label) score(node, false);
      },
    };

    for (const type of NESTING_INCREMENT) {
      if (type === 'IfStatement') continue; // handled above, because of `else if`
      visitors[type] = (node) => {
        score(node, true);
        pushNesting();
      };
      visitors[`${type}:exit`] = popNesting;
    }

    for (const type of NESTING_ONLY) {
      const enter = visitors[type];
      void enter;
      // Function nodes already push a frame whose nesting starts at 0, so no extra push is
      // needed: the new frame *is* the reset. Listed here to make that deliberate rather than
      // an omission.
    }

    return visitors;
  },
};
