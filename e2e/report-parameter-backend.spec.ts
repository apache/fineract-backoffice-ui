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
 * Proves dynamic report parameters against a real Fineract instance.
 *
 * Client Listing scopes its rows by Office. Head Office includes descendants, while a branch
 * includes only that branch. Two seeded clients therefore make the selected parameter observable
 * in the returned row set. A test that only checked that a table rendered would miss the original
 * bug, where the UI silently omitted a declared parameter and Fineract returned the wrong scope.
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { ionSelect, ionSelectValue, isIonSelectDisabled } from './utils/ionic-locators';
import { selectOption } from './utils/select-option';
import {
  createApiContext,
  seedChartReport,
  seedClient,
  seedLoanProduct,
  seedOffice,
} from './utils/seed-api';

const REPORT_NAME = 'Client Listing';
const CASCADING_REPORT_NAME = 'Active Loans - Summary';
const HEAD_OFFICE = 'Head Office';

/**
 * Declares Currency -> Product and, unlike every other stock loan report, no Loan Officer.
 *
 * That matters: the stock loan-officer lookup compares a bigint column against a bound string
 * (`o.id = '${officeId}'`) and answers 403 on PostgreSQL whatever the UI sends, so a report
 * carrying it would exercise that platform defect rather than the cascade.
 */
const PRODUCT_CASCADE_REPORT = 'Written-Off Loans';

test.describe('Dynamic report parameters against Fineract', () => {
  test('keeps the parameter form available when a report has cascading lookups', async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/reporting/run/${encodeURIComponent(CASCADING_REPORT_NAME)}?type=Table`);

    await expect(page.locator('ion-card-title')).toContainText(CASCADING_REPORT_NAME);
    await expect(page.getByTestId('report-parameters-error')).toHaveCount(0);
    await expect(page.getByTestId('report-parameter-officeId')).toBeVisible();
    await expect(page.getByTestId('report-parameter-loanOfficerId')).toBeVisible();
  });

  test('changing Office changes the Client Listing row set', async ({ page }) => {
    const api = await createApiContext();
    const branch = await seedOffice(api, 'E2EReportParameters');
    const headOfficeClient = await seedClient(api, 'E2EReportHead');
    const branchClient = await seedClient(api, 'E2EReportBranch', branch.officeId);
    await api.dispose();

    await login(page);
    await page.goto(`/reporting/run/${encodeURIComponent(REPORT_NAME)}?type=Table`);
    await expect(page.locator('ion-card-title')).toContainText(REPORT_NAME);

    const runForOffice = async (
      officeName: string,
      expectedClientName: string,
      optionName: string | RegExp = officeName,
    ): Promise<string[]> => {
      if (typeof optionName === 'string') {
        await selectOption(page, 'Office', optionName);
      } else {
        await ionSelect(page, 'Office').click();
        await page
          .locator('ion-alert, ion-popover, ion-action-sheet')
          .getByRole('radio', { name: optionName })
          .click();
      }
      const reportResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname.endsWith(`/runreports/${encodeURIComponent(REPORT_NAME)}`) &&
          url.searchParams.get('exportCSV') === 'false' &&
          response.ok()
        );
      });
      await page.getByTestId('run-report').click();
      await reportResponse;
      const rows = page.locator('table tbody tr');
      await expect(rows.first()).toBeVisible({ timeout: 20000 });
      const pageSize = page.getByTestId('paginator-page-size');
      if (
        (await pageSize.evaluate((select: HTMLElement & { value: unknown }) => select.value)) !==
        100
      ) {
        await pageSize.click();
        await page.locator('ion-popover').getByRole('radio', { name: '100' }).click();
      }
      await expect(page.locator('table')).toContainText(expectedClientName);
      return rows.allTextContents();
    };

    const headOfficeRows = await runForOffice(HEAD_OFFICE, headOfficeClient.displayName);
    // Fineract indents descendant office labels with dots. Match the seeded office name at the
    // end so this proof is independent of its depth in the office hierarchy.
    const escapedBranchName = branch.officeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const branchRows = await runForOffice(
      branch.officeName,
      branchClient.displayName,
      new RegExp(`${escapedBranchName}$`),
    );

    expect(headOfficeRows.join(' ')).toContain(headOfficeClient.displayName);
    expect(branchRows.join(' ')).toContain(branchClient.displayName);
    expect(branchRows.join(' ')).not.toContain(headOfficeClient.displayName);
    expect(branchRows).not.toEqual(headOfficeRows);
  });
});

test.describe('Cascading report parameters against Fineract', () => {
  /**
   * Proves the cascade by what it *sends*, not by two currencies.
   *
   * Making "scoped to the selection" differ from "everything" in the returned list would need a
   * second enabled currency with a product in it — and that is a one-way door. Enabling a currency
   * is tenant-wide, and once any product uses it the platform refuses to disable it again
   * (`error.msg.currency.currencyCode.inUse`), so the suite could never put the tenant back.
   * That matters beyond tidiness: `cashier-transaction-form.component.ts` fills its currency in
   * automatically only when the tenant has exactly one, so a second currency makes the teller spec
   * — which never had to choose one — post without a currency and read a zero total back.
   *
   * The parent value reaching the lookup, the refetch on change, and the child being cleared are
   * the whole of what #301 does, and all three are observable without touching tenant currencies.
   * Which options a given parent value yields is pinned by the unit specs.
   */
  const PRODUCT_LOOKUP = '/runreports/loanProductIdSelectAll';

  test('sends the parent value to the child lookup and clears the child when it changes', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();
    // A product of its own, so the list is proven to be populated from the lookup rather than
    // merely carrying the client-side "All" entry.
    const product = await seedLoanProduct(api, 'E2EReportCascade');
    await api.dispose();

    await login(page);
    await page.goto(`/reporting/run/${encodeURIComponent(PRODUCT_CASCADE_REPORT)}?type=Table`);
    await expect(page.locator('ion-card-title')).toContainText(PRODUCT_CASCADE_REPORT);

    // Until Currency has a value there is nothing meaningful to offer, so the control says so
    // rather than presenting every product in the institution.
    await expect(page.getByTestId('report-parameter-loanProductId')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId('report-parameter-loanProductId-waiting')).toBeVisible();
    expect(await isIonSelectDisabled(page, 'Product')).toBe(true);

    const lookupFor = () =>
      page.waitForRequest((request) => request.url().includes(PRODUCT_LOOKUP), { timeout: 20000 });

    const scopedLookup = lookupFor();
    await selectOption(page, 'Currency', 'US Dollar');
    expect(new URL((await scopedLookup).url()).searchParams.get('R_currencyId')).toBe('USD');

    await expect(page.getByTestId('report-parameter-loanProductId-waiting')).toHaveCount(0);
    await expect.poll(() => isIonSelectDisabled(page, 'Product'), { timeout: 20000 }).toBe(false);

    await selectOption(page, 'Product', product.productName);
    expect(await ionSelectValue(page, 'Product')).toBe(product.productId);

    // The regression this guards: a stale product surviving a currency change would filter the
    // report to a product that does not exist in the chosen currency, returning nothing.
    const refetch = lookupFor();
    await selectOption(page, 'Currency', 'All');
    expect(new URL((await refetch).url()).searchParams.get('R_currencyId')).toBe('-1');
    await expect.poll(() => ionSelectValue(page, 'Product'), { timeout: 20000 }).toBeNull();
  });
});

test.describe('Chart reports against Fineract', () => {
  test('renders a chart report as a chart rather than a table', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();
    const report = await seedChartReport(api, 'E2EChart', 'Bar');
    await api.dispose();

    await login(page);
    await page.goto(
      `/reporting/run/${encodeURIComponent(report.reportName)}?type=Chart&subType=Bar`,
    );
    await expect(page.locator('ion-card-title')).toContainText(report.reportName);

    const reportResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith(`/runreports/${encodeURIComponent(report.reportName)}`) &&
        response.ok()
      );
    });
    await page.getByTestId('run-report').click();
    await reportResponse;

    // The platform returns the same generic resultset it returns for a table report, so the
    // chart existing at all is the proof that the declared report type was honoured.
    await expect(page.getByTestId('report-chart-bar')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('report-table')).toHaveCount(0);
    await expect(page.getByTestId('report-chart-bar')).toContainText(HEAD_OFFICE);
  });
});
