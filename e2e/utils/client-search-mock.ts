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

import { Page } from '../fixtures';

/** Serve the v2 API shape from the same client fixtures used by v1 form mocks. */
export async function mockClientTextSearch(page: Page, clients: readonly unknown[] = []) {
  await page.route('**/api/v2/clients/search', async (route) => {
    const { request, page: pageIndex = 0, size = 10 } = route.request().postDataJSON();
    const text = String(request?.text ?? '').toLowerCase();
    const matches = clients
      .map((value) => {
        const client = value as Record<string, unknown>;
        return { ...client, accountNumber: client['accountNo'] };
      })
      .filter((client) =>
        ['displayName', 'accountNumber', 'externalId', 'mobileNo'].some((key) =>
          String((client as Record<string, unknown>)[key] ?? '')
            .toLowerCase()
            .includes(text),
        ),
      );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: matches.slice(pageIndex * size, (pageIndex + 1) * size),
        totalElements: matches.length,
      }),
    });
  });
}
