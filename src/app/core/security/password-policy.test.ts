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

import { rulesFor, satisfiesPolicy, unmetRules } from './password-policy';

/**
 * The three policies as `GET /passwordpreferences/template` really answers them, measured
 * against a running Fineract. Only `key` chooses the rules; the description is the helper text.
 */
const SIMPLE = {
  key: 'simple',
  description: 'Password most be at least 1 character and not more that 50 characters long',
};
const SECURE = {
  key: 'secure',
  description:
    'Password must be at least 6 characters, no more than 50 characters long, must include at least one upper case letter, one lower case letter, one numeric digit and no space',
};
const STRONG = {
  key: 'strong',
  description:
    'Password must be 12 to 50 characters long, containing at least one uppercase letter, one lowercase letter, one numeric digit, and one special character, with no spaces or consecutive repeating characters',
};

/** Satisfies every rule of the strong policy, which the platform accepted as measured. */
const GOOD_STRONG = 'Xq7!vTz3mKp9';

describe('rulesFor', () => {
  it('reads the rules off the policy key the platform names', () => {
    expect(rulesFor(SIMPLE).map((rule) => rule.id)).toEqual(['length']);
    expect(rulesFor(SECURE).map((rule) => rule.id)).toEqual([
      'length',
      'uppercase',
      'lowercase',
      'digit',
      'noSpace',
    ]);
    expect(rulesFor(STRONG).map((rule) => rule.id)).toEqual([
      'length',
      'uppercase',
      'lowercase',
      'digit',
      'special',
      'noSpace',
      'noRepeat',
    ]);
  });

  /**
   * The client must never be stricter than the platform. A policy this file has not heard of —
   * a future key, or a read that failed — falls back to the loosest set, so the form cannot
   * refuse a password the platform would have taken.
   */
  it('falls back to the loosest rules for an unknown or absent policy', () => {
    expect(rulesFor({ key: 'paranoid', description: 'who knows' })).toEqual(rulesFor(SIMPLE));
    expect(rulesFor(null)).toEqual(rulesFor(SIMPLE));
    expect(rulesFor(undefined)).toEqual(rulesFor(SIMPLE));
  });

  it('carries the length bounds as parameters, so one key serves all three policies', () => {
    expect(rulesFor(STRONG)[0].params).toEqual({ min: 12, max: 50 });
    expect(rulesFor(SECURE)[0].params).toEqual({ min: 6, max: 50 });
    expect(rulesFor(SIMPLE)[0].params).toEqual({ min: 1, max: 50 });
  });
});

describe('unmetRules', () => {
  it('accepts a password the platform accepted', () => {
    expect(unmetRules(GOOD_STRONG, STRONG)).toEqual([]);
    expect(satisfiesPolicy(GOOD_STRONG, STRONG)).toBe(true);
  });

  /**
   * The clause that catches people out, and the reason this exists: the platform's message
   * lists every rule and says nothing about which one failed, so "passsword1A!x" — rejected for
   * its `ss` alone — reads as a wall of text. Named here, the form can point at the pair.
   */
  it('names the consecutive-repeat rule, and only that one, for a password that only repeats', () => {
    expect(unmetRules('passsword1A!x', STRONG).map((rule) => rule.id)).toEqual(['noRepeat']);
  });

  it('names every rule a short, plain password fails', () => {
    expect(unmetRules('abc', STRONG).map((rule) => rule.id)).toEqual([
      'length',
      'uppercase',
      'digit',
      'special',
    ]);
  });

  /**
   * An empty password fails the length rule and every "must contain" rule; the two prohibitions
   * — no space, no repeat — are vacuously satisfied by having no characters at all. That is
   * enough for the form: unmet and required are one message rather than two.
   */
  it('reports the unmet rules for an empty password, so required and unmet are one message', () => {
    expect(unmetRules('', STRONG).map((rule) => rule.id)).toEqual([
      'length',
      'uppercase',
      'lowercase',
      'digit',
      'special',
    ]);
    expect(satisfiesPolicy('', SIMPLE)).toBe(false);
  });

  it('refuses a space under the policies that forbid one, and allows it where none does', () => {
    expect(unmetRules('Xq7! vTz3mKp', STRONG).map((rule) => rule.id)).toContain('noSpace');
    expect(unmetRules('a space is fine here', SIMPLE)).toEqual([]);
  });

  it('counts an underscore as a word character, as the platform does', () => {
    // `[^\w\s]` is the platform's own special-character class, so `_` does not satisfy it.
    expect(unmetRules('Xq7_vTz3mKp9', STRONG).map((rule) => rule.id)).toEqual(['special']);
  });

  it('refuses a password over the maximum, which is a rule in every policy', () => {
    const tooLong = 'Xq7!vTz3mKp9'.repeat(5);

    expect(unmetRules(tooLong, STRONG).map((rule) => rule.id)).toContain('length');
    expect(unmetRules(tooLong, SIMPLE).map((rule) => rule.id)).toContain('length');
  });

  it('applies the secure policy where it is laxer than the strong one', () => {
    // Six characters with no special, which `secure` allows and `strong` does not.
    expect(unmetRules('Ab3xyz', SECURE)).toEqual([]);
    expect(unmetRules('Ab3xyz', STRONG).map((rule) => rule.id)).toEqual(['length', 'special']);
  });
});
