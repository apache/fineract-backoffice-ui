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

import { Page, Route, expect } from '@playwright/test';

/**
 * Runs `action` and returns the parsed JSON body of the request it triggers.
 *
 * `page.waitForResponse(...)` then `response.json()` cannot be used here. The body
 * lives in the browser until it is asked for, and Chrome discards it the moment the
 * page navigates — which these forms do as soon as the save succeeds. The read then
 * fails with "Protocol error (Network.getResponseBody): No data found for resource
 * with given identifier", and `response.finished()` is worse: it waits for a body
 * that is never coming, so the test burns its entire timeout instead of failing.
 *
 * Intercepting instead means the body is fetched and parsed in Node, before the page
 * is ever given it, so navigation cannot take it away. The response is passed
 * through unchanged, so the app behaves exactly as it would without the intercept.
 */
/**
 * How long to wait for the intercepted response.
 *
 * Under `DEMO_RECORD=1` every action carries a pause and the browser is doing more work per
 * frame, so a window sized for a full-speed run is not the same window while filming — a fixed
 * budget here fails the flow for reasons that have nothing to do with the application.
 */
function captureTimeout(): number {
  return process.env.DEMO_RECORD === '1' ? 60000 : 20000;
}

export async function captureJson<T>(
  page: Page,
  urlPattern: RegExp,
  method: string,
  action: () => Promise<void>,
): Promise<T> {
  let captured: T | undefined;

  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method) {
      return route.fallback();
    }
    const response = await route.fetch();
    const body = await response.text();
    try {
      captured = JSON.parse(body) as T;
    } catch {
      // Not JSON — leave `captured` unset so the poll below reports the timeout
      // against the caller's line rather than throwing from inside the handler.
    }
    await route.fulfill({ response, body });
  };

  await page.route(urlPattern, handler);
  try {
    await action();
    await expect.poll(() => captured, { timeout: captureTimeout() }).toBeDefined();
  } finally {
    await page.unroute(urlPattern, handler);
  }

  return captured as T;
}
