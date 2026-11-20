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

/** What a masked value is shown as. Fixed length, so it does not give away the secret's. */
export const MASK = '••••••';

/**
 * Key fragments that mark a value as secret, compared after lower-casing and dropping
 * separators, so `repeatPassword`, `client_secret` and `X-Auth-Token` all match.
 */
const SECRET_FRAGMENTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'credential',
  'authorization',
  'authenticationkey',
  // Fineract's own external-service settings: S3, FCM and the SMS bridge.
  'accesskey',
  'serverkey',
  'appkey',
  'signingkey',
  'passcode',
  'mpin',
  'transactionpin',
];

/**
 * Words too short to match as fragments without catching unrelated names. They count as a whole
 * word of the key, so `newPin`, `otpCode` and `cvv2` match and `spinner` does not.
 */
const SECRET_WORDS = new Set(['pwd', 'pass', 'pin', 'otp', 'cvv', 'cvv2']);

/** Keys that name the field in a `{ name, value }` pair, as external-service settings are sent. */
const PAIR_NAME_KEYS = new Set(['name', 'key', 'field', 'property']);
const PAIR_VALUE_KEYS = new Set(['value', 'newValue', 'oldValue']);

export function isSecretKey(key: string): boolean {
  const normalised = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
  // `pinCode` is an Indian postal code, not a PIN.
  if (normalised.endsWith('pincode')) return false;
  const words = key
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return (
    words.some((word) => SECRET_WORDS.has(word)) ||
    SECRET_FRAGMENTS.some((f) => normalised.includes(f))
  );
}

/**
 * Whether a value under this key is replaced. A boolean is a setting about the secret, such as
 * `passwordNeverExpires`, not the secret, and is what an auditor needs to see.
 */
function hidesValue(key: string, value: unknown): boolean {
  return typeof value !== 'boolean' && isSecretKey(key);
}

function maskValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskValue);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    // `{ "name": "password", "value": "x" }` names its secret in a sibling field.
    const namesSecret = entries.some(
      ([key, inner]) => PAIR_NAME_KEYS.has(key) && typeof inner === 'string' && isSecretKey(inner),
    );
    return Object.fromEntries(
      entries.map(([key, inner]) => [
        key,
        hidesValue(key, inner) || (namesSecret && PAIR_VALUE_KEYS.has(key))
          ? MASK
          : maskValue(inner),
      ]),
    );
  }
  if (typeof value === 'string') return maskEmbedded(value);
  return value;
}

/**
 * A string field can carry secrets of its own: JSON such as a forwarded request body, or
 * `key=value` text such as a hook URL with `?api_key=` in it.
 */
function maskEmbedded(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(maskValue(JSON.parse(trimmed)));
    } catch {
      // Not JSON after all; fall through to the pair scanner.
    }
  }
  return maskText(text);
}

/** A `"key":`, `'key':` or `key=` in text that is not valid JSON. */
const KEY = /(["']?)([\w.-]+)\1\s*[:=]\s*/g;

/**
 * Masks the value after every secret key in text that is not valid JSON, so a truncated or
 * hand-written payload is masked too. A quoted value runs to its closing quote; an unquoted one
 * runs to the next separator or line end, spaces included, since masking too much beats showing
 * the tail of a passphrase. Values after other keys are left alone and not consumed, so a secret
 * pair later in the same run is still found.
 *
 * Best effort: Fineract stores valid JSON, so this only sees truncated or hand-written text, and
 * a key with spaces in it or a name/value pair is not recognised here.
 */
function maskText(text: string): string {
  let out = '';
  let from = 0;
  for (const match of text.matchAll(KEY)) {
    if (match.index < from || !isSecretKey(match[2])) continue;
    const start = match.index + match[0].length;
    out += `${text.slice(from, start)}"${MASK}"`;
    from = valueEnd(text, start);
  }
  return out + text.slice(from);
}

/** Where the value starting at `start` ends: past its closing quote, or at the next separator. */
function valueEnd(text: string, start: number): number {
  const quote = text[start];
  if (quote === '"' || quote === "'") {
    const close = (quote === '"' ? /(?<!\\)"/ : /(?<!\\)'/).exec(text.slice(start + 1));
    return close ? start + 1 + close.index + 1 : text.length;
  }
  const stop = /[,;&}\]\n]/.exec(text.slice(start));
  return stop ? start + stop.index : text.length;
}

/**
 * Pretty-prints an audited command payload with every secret-looking value replaced by `MASK`.
 *
 * The text is re-formatted through `JSON.parse`, so it is not byte-for-byte what Fineract stored:
 * `100.00` reads as `100`, and integers beyond 2^53 lose precision.
 *
 * Fineract stores the payload as submitted, so a user creation or password change carries the
 * password in clear. This is defence in depth: `READ_AUDIT` is still what keeps the payload
 * from people who should not see it.
 */
export function maskPayload(payload: string | null | undefined): string {
  if (!payload) return '';
  try {
    return JSON.stringify(maskValue(JSON.parse(payload)), null, 2);
  } catch {
    return maskText(payload);
  }
}
