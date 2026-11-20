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
 * The tenant's password policy, and what a candidate password fails to satisfy.
 *
 * ## Where the rules come from
 *
 * `GET /passwordpreferences` answers the **active** policy and `GET /passwordpreferences/template`
 * all three, each as `{ id, description, active, key }`. Measured against a running Fineract,
 * the three keys and their descriptions are:
 *
 * | `key`    | description the platform gives                                                |
 * | -------- | ----------------------------------------------------------------------------- |
 * | `simple` | at least 1 character and not more that 50 characters long                      |
 * | `secure` | at least 6, no more than 50, one upper, one lower, one digit and no space      |
 * | `strong` | 12 to 50, one upper, one lower, one digit, one special, no space, no repeats   |
 *
 * What it does **not** answer is the regex it enforces. That appears in exactly one place —
 * the `args` of the validation error on a rejected password — and that is now suppressed,
 * because the same `args` carry the submitted password in clear text (#752). So the rules are
 * mirrored here, keyed on the policy the platform names, rather than parsed from a pattern the
 * platform does not publish.
 *
 * Mirroring carries one obligation: the client must never be stricter than the platform. Each
 * rule below is taken from the description above, and an unrecognised key falls back to the
 * loosest set, so a policy this file has not heard of cannot block a password the platform
 * would have accepted. The platform remains the authority — it validates every password again —
 * and this only spares the user learning the policy by round trip (#753).
 */

/** The policy as the platform states it. `key` is what the rules below are chosen by. */
export interface PasswordPolicy {
  /** `simple`, `secure` or `strong` — the platform's own name for the active policy. */
  readonly key: string;
  /** The platform's own description, shown verbatim as the field's helper text. */
  readonly description: string;
}

/** One rule a password either satisfies or does not. */
export interface PasswordRule {
  /** Stable id, for test and `data-testid` use. */
  readonly id: string;
  /** Translation key for the rule as the user reads it. */
  readonly labelKey: string;
  /** Interpolation parameters for {@link labelKey}, where it takes any. */
  readonly params?: Readonly<Record<string, number>>;
  /** Whether this password satisfies the rule. */
  readonly satisfiedBy: (password: string) => boolean;
}

const lengthRule = (min: number, max: number): PasswordRule => ({
  id: 'length',
  labelKey: 'USERS.PASSWORD_RULES.LENGTH',
  params: { min, max },
  satisfiedBy: (password) => password.length >= min && password.length <= max,
});

const UPPERCASE: PasswordRule = {
  id: 'uppercase',
  labelKey: 'USERS.PASSWORD_RULES.UPPERCASE',
  satisfiedBy: (password) => /[A-Z]/.test(password),
};

const LOWERCASE: PasswordRule = {
  id: 'lowercase',
  labelKey: 'USERS.PASSWORD_RULES.LOWERCASE',
  satisfiedBy: (password) => /[a-z]/.test(password),
};

const DIGIT: PasswordRule = {
  id: 'digit',
  labelKey: 'USERS.PASSWORD_RULES.DIGIT',
  satisfiedBy: (password) => /\d/.test(password),
};

/**
 * One character that is neither a letter, a digit nor an underscore.
 *
 * `[^\w\s]` is the platform's own class for this, from the regex its error carried.
 */
const SPECIAL: PasswordRule = {
  id: 'special',
  labelKey: 'USERS.PASSWORD_RULES.SPECIAL',
  satisfiedBy: (password) => /[^\w\s]/.test(password),
};

const NO_SPACE: PasswordRule = {
  id: 'noSpace',
  labelKey: 'USERS.PASSWORD_RULES.NO_SPACE',
  satisfiedBy: (password) => !/\s/.test(password),
};

/**
 * No character may repeat immediately.
 *
 * The clause that catches people out: "password" fails the strong policy on its `ss` alone, and
 * nothing in the platform's message says which pair offended.
 */
const NO_CONSECUTIVE_REPEAT: PasswordRule = {
  id: 'noRepeat',
  labelKey: 'USERS.PASSWORD_RULES.NO_REPEAT',
  satisfiedBy: (password) => !/(.)\1/.test(password),
};

/** The loosest set, which an unknown policy key falls back to. */
const SIMPLE_RULES: readonly PasswordRule[] = [lengthRule(1, 50)];

const SECURE_RULES: readonly PasswordRule[] = [
  lengthRule(6, 50),
  UPPERCASE,
  LOWERCASE,
  DIGIT,
  NO_SPACE,
];

const STRONG_RULES: readonly PasswordRule[] = [
  lengthRule(12, 50),
  UPPERCASE,
  LOWERCASE,
  DIGIT,
  SPECIAL,
  NO_SPACE,
  NO_CONSECUTIVE_REPEAT,
];

/**
 * The rules of this policy.
 *
 * An absent policy — the read failed, or has not answered yet — gets the loosest set rather
 * than none: a form that cannot reach the policy must still refuse an empty password, and must
 * not refuse anything else the platform would take.
 */
export function rulesFor(policy: PasswordPolicy | null | undefined): readonly PasswordRule[] {
  switch (policy?.key) {
    case 'strong': {
      return STRONG_RULES;
    }
    case 'secure': {
      return SECURE_RULES;
    }
    default: {
      return SIMPLE_RULES;
    }
  }
}

/**
 * The rules this password does not satisfy, in the order they are shown.
 *
 * Empty for a password the policy accepts. An empty password reports every rule rather than
 * none, which is what keeps "required" and "does not meet the policy" one message instead of
 * two.
 */
export function unmetRules(
  password: string,
  policy: PasswordPolicy | null | undefined,
): readonly PasswordRule[] {
  return rulesFor(policy).filter((rule) => !rule.satisfiedBy(password));
}

/** Whether this password satisfies every rule of the policy. */
export function satisfiesPolicy(
  password: string,
  policy: PasswordPolicy | null | undefined,
): boolean {
  return unmetRules(password, policy).length === 0;
}
