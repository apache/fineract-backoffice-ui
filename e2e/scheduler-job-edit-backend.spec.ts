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
 * Edits a scheduler job against a real Fineract.
 *
 * The mocked spec proves what the form sends; only the platform can prove what it does with it:
 * that a new expression is rescheduled (the list's Next Run moves), and that Fineract's own
 * Quartz check refuses what the form would have caught. The job is rescheduled to a single run in
 * 2099, so nothing fires while the spec runs, and its original schedule is put back afterwards.
 */

import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';
import { API_BASE, createApiContext } from './utils/seed-api';

interface Job {
  jobId: number;
  displayName: string;
  cronExpression: string;
  active: boolean;
  currentlyRunning: boolean;
}

/** Midday mid-month, so 2099 reads the same in any browser zone the runner uses. */
const FAR_FUTURE = '0 0 12 15 6 ? 2099';

let api: APIRequestContext;
let original: Job;

test.describe('Scheduler job edit against Fineract', () => {
  // One job, edited and restored: the two tests must not interleave with each other's state.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    api = await createApiContext();
    const res = await api.get(`${API_BASE}/jobs`);
    expect(res.ok(), `GET /jobs answered ${res.status()}`).toBe(true);
    const jobs = (await res.json()) as Job[];
    // The first job is on the list's first page; one mid-run would be shown read-only.
    const job = jobs.find((candidate) => !candidate.currentlyRunning);
    expect(job, 'an idle scheduler job to edit').toBeDefined();
    original = job!;
  });

  test.afterAll(async () => {
    const restored = await api.put(`${API_BASE}/jobs/${original.jobId}`, {
      data: { cronExpression: original.cronExpression, active: original.active },
    });
    expect(restored.ok(), `restoring job ${original.jobId} answered ${restored.status()}`).toBe(
      true,
    );
    await api.dispose();
  });

  test('a new expression is rescheduled, and the list shows its next run', async ({ page }) => {
    await login(page);
    await page.goto(`/system/scheduler-jobs/${original.jobId}/edit`);

    await page.getByTestId('scheduler-job-cron').fill(FAR_FUTURE);
    await page.getByTestId('scheduler-job-active').check();
    const [saved] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/jobs/${original.jobId}`) &&
          response.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);
    expect(saved.status(), (await saved.text()).slice(0, 300)).toBe(200);

    await expect(page).toHaveURL('/system/scheduler-jobs');
    await expect(
      page
        .getByRole('row', {
          name: original.displayName,
        })
        .first(),
    ).toContainText('2099');
  });

  test('Fineract refuses an expression Quartz rejects', async () => {
    // Both day fields specified: valid Unix cron, a Quartz parse error. The form refuses it
    // before sending; this confirms the platform agrees, with the code it names the rule by.
    const res = await api.put(`${API_BASE}/jobs/${original.jobId}`, {
      data: { cronExpression: '0 0 * * * *' },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { errors?: { userMessageGlobalisationCode?: string }[] };
    // Either code: the platform renamed this rule, and `apache/fineract:latest` is not pinned, so
    // a run can meet either version. `validation.msg.schedulerjob.cronExpression.invalid` is what
    // it answered until November 2026; `...job.update.assertion.cron-expression` is the assertion
    // name it answers with now. What is being measured is that the platform refuses the
    // expression and names a cron rule for it, which both codes do, so pinning one of them only
    // dates the test. Nothing in the UI reads either code: the form refuses the expression before
    // sending, and this exists to confirm the platform agrees.
    expect(body.errors?.map((error) => error.userMessageGlobalisationCode)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^(validation\.msg\.schedulerjob\.cronExpression\.invalid|org\.apache\.fineract\.infrastructure\.job\.update\.assertion\.cron-expression)$/,
        ),
      ]),
    );
  });
});
