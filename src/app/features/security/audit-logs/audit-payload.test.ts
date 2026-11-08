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

import { MASK, isSecretKey, maskPayload } from './audit-payload';

describe('maskPayload', () => {
  it('masks the password keys a user creation sends, and keeps everything else', () => {
    const payload = JSON.stringify({
      username: 'teller1',
      password: 'S3cret!pass',
      repeatPassword: 'S3cret!pass',
      officeId: 1,
    });

    const masked = JSON.parse(maskPayload(payload));

    expect(masked).toEqual({
      username: 'teller1',
      password: MASK,
      repeatPassword: MASK,
      officeId: 1,
    });
  });

  it('never lets the original secret through to the rendered text', () => {
    const out = maskPayload('{"clientSecret":"abc123xyz","note":"ok"}');

    expect(out).not.toContain('abc123xyz');
    expect(out).toContain('"note": "ok"');
  });

  it('masks secrets nested in objects and arrays', () => {
    const payload = JSON.stringify({
      config: { apiKey: 'k-1', host: 'smtp.example.org' },
      hooks: [{ name: 'h', token: 't-1' }],
    });

    const masked = JSON.parse(maskPayload(payload));

    expect(masked.config).toEqual({ apiKey: MASK, host: 'smtp.example.org' });
    expect(masked.hooks).toEqual([{ name: 'h', token: MASK }]);
  });

  it('replaces a secret object or number whole, not field by field', () => {
    const masked = JSON.parse(maskPayload('{"credentials":{"user":"u","pass":"p"},"pin":1234}'));

    expect(masked.credentials).toBe(MASK);
    expect(masked.pin).toBe(MASK);
  });

  it('pretty-prints a payload with nothing to mask', () => {
    expect(maskPayload('{"approvedLoanAmount":50000}')).toBe('{\n  "approvedLoanAmount": 50000\n}');
  });

  it('masks key-value pairs in a payload that is not valid JSON', () => {
    const out = maskPayload('{"username":"u","password":"hunter2", truncated');

    expect(out).not.toContain('hunter2');
    expect(out).toContain(`"password":"${MASK}"`);
    expect(out).toContain('"username":"u"');
  });

  it('masks form-encoded pairs too', () => {
    const out = maskPayload('user=u&token=abc&mode=x');

    expect(out).toBe(`user=u&token="${MASK}"&mode=x`);
  });

  it("masks Fineract's own external-service secrets", () => {
    // `PUT /externalservice/{name}` is audited, and these are its S3, FCM and SMS keys.
    const masked = JSON.parse(
      maskPayload('{"s3_access_key":"AKIA1","server_key":"fcm-1","tenant_app_key":"sms-1"}'),
    );

    expect(masked).toEqual({ s3_access_key: MASK, server_key: MASK, tenant_app_key: MASK });
  });

  it('masks the value of a name/value pair that names a secret', () => {
    const masked = JSON.parse(
      maskPayload('[{"name":"password","value":"x1"},{"name":"host","value":"smtp.example.org"}]'),
    );

    expect(masked).toEqual([
      { name: 'password', value: MASK },
      { name: 'host', value: 'smtp.example.org' },
    ]);
  });

  it('masks secrets inside a string field that holds JSON of its own', () => {
    const out = maskPayload(JSON.stringify({ body: JSON.stringify({ password: 'inner-pass' }) }));

    expect(out).not.toContain('inner-pass');
    expect(JSON.parse(JSON.parse(out).body)).toEqual({ password: MASK });
  });

  it('masks an unquoted value with spaces to the end of the pair', () => {
    const out = maskPayload('password=correct horse battery, user=u');

    expect(out).toBe(`password="${MASK}", user=u`);
  });

  it('finds a secret that follows an ordinary pair in the same run', () => {
    const out = maskPayload('note=see below token=abc;');

    expect(out).not.toContain('abc');
  });

  it('masks a key=value secret inside an ordinary string field', () => {
    const out = maskPayload(
      JSON.stringify({ payloadUrl: 'https://hooks.example.org/x?api_key=k-77&mode=a', name: 'h' }),
    );

    expect(out).not.toContain('k-77');
    expect(out).toContain('mode=a');
  });

  it('leaves a boolean setting about a password visible', () => {
    const masked = JSON.parse(
      maskPayload('{"passwordNeverExpires":true,"sendPasswordToEmail":false,"password":"x9"}'),
    );

    expect(masked).toEqual({
      passwordNeverExpires: true,
      sendPasswordToEmail: false,
      password: MASK,
    });
  });

  it('masks single-quoted values in text that is not JSON', () => {
    const out = maskPayload("{'password': 'a,b', user: 'x'");

    expect(out).not.toContain('a,b');
    expect(out).not.toContain("b'");
    expect(out).toContain("user: 'x'");
  });

  it('renders nothing for an entry without a payload', () => {
    expect(maskPayload(null)).toBe('');
    expect(maskPayload('')).toBe('');
  });
});

describe('isSecretKey', () => {
  it.each([
    'password',
    'repeatPassword',
    'PASSWORD_CONFIRM',
    'secret',
    'client_secret',
    'token',
    'X-Auth-Token',
    'refreshToken',
    'apiKey',
    'private_key',
    'base64EncodedAuthenticationKey',
    'pin',
    'otp',
    'pass',
    'passcode',
    's3_access_key',
    's3_secret_key',
    'server_key',
    'tenant_app_key',
    'signingKey',
    'mpin',
    'transactionPin',
    'newPin',
    'card_pin',
    'otpCode',
    'cvv2',
  ])('treats %s as secret', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each([
    'username',
    'officeId',
    'pinCode',
    'postal_pin_code',
    'shipping',
    'spinner',
    'passport',
    'approvedLoanAmount',
    'note',
  ])('leaves %s visible', (key) => {
    expect(isSecretKey(key)).toBe(false);
  });
});
