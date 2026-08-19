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

import { request as playwrightRequest } from '@playwright/test';

/** The mail catcher's HTTP API, as published by `deploy/docker-compose-e2e-2fa.yml`. */
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';

/**
 * The one-time token Fineract just emailed, read out of the mail catcher.
 *
 * There is no other way to obtain it. Fineract sends the token before persisting anything, so a
 * deployment without a reachable SMTP server issues no token at all — `POST /v1/twofactor`
 * answers 500 and `twofactor_access_token` stays empty. Reading the mailbox is not a shortcut
 * around the product; it is standing in for the user's inbox.
 *
 * @param since - ignore anything already in the mailbox when the test started
 */
export async function latestOtp(since = 0): Promise<string> {
  const api = await playwrightRequest.newContext();
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await api.get(`${MAILPIT}/api/v1/messages`);
      if (response.ok()) {
        const inbox = (await response.json()) as { messages?: { ID: string; Created: string }[] };
        const message = (inbox.messages ?? []).find((m) => new Date(m.Created).getTime() >= since);
        if (message) {
          const detail = await api.get(`${MAILPIT}/api/v1/message/${message.ID}`);
          const body = (await detail.json()) as { Text?: string; HTML?: string };
          // "Hello mifos. Your OTP login token is NMKH4." — alphanumeric, not digits, which is
          // the detail that catches people writing a \d+ pattern.
          const token = /token is ([A-Za-z0-9]+)/.exec(body.Text ?? body.HTML ?? '')?.[1];
          if (token) return token;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No one-time token arrived at ${MAILPIT} within 15s.`);
  } finally {
    await api.dispose();
  }
}

/** Empties the mailbox, so a test reads its own token rather than a previous run's. */
export async function clearMailbox(): Promise<void> {
  const api = await playwrightRequest.newContext();
  try {
    await api.delete(`${MAILPIT}/api/v1/messages`);
  } finally {
    await api.dispose();
  }
}
