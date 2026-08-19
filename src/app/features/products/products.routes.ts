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

import { authGuard } from '../../core/guards/auth.guard';
import { permissionGuard } from '../../core/guards/permission.guard';
import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: 'loan',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOANPRODUCT' },
    title: 'nav.loanProducts',
    loadComponent: () =>
      import('./loan-products-list.component').then((m) => m.LoanProductsListComponent),
  },
  {
    path: 'loan/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_LOANPRODUCT' },
    title: 'PRODUCTS.CREATE_LOAN_PRODUCT',
    loadComponent: () =>
      import('./loan-product-form.component').then((m) => m.LoanProductFormComponent),
  },
  {
    path: 'loan/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_LOANPRODUCT' },
    title: 'PRODUCTS.EDIT_LOAN_PRODUCT',
    loadComponent: () =>
      import('./loan-product-form.component').then((m) => m.LoanProductFormComponent),
  },
  {
    path: 'loan/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOANPRODUCT' },
    title: 'nav.loanProductDetails',
    loadComponent: () =>
      import('./loan-product-view.component').then((m) => m.LoanProductViewComponent),
  },
  {
    path: 'savings',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SAVINGSPRODUCT' },
    title: 'nav.savingsProducts',
    loadComponent: () =>
      import('./savings-products-list.component').then((m) => m.SavingsProductsListComponent),
  },
  {
    path: 'savings/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_SAVINGSPRODUCT' },
    title: 'PRODUCTS.CREATE_SAVINGS_PRODUCT',
    loadComponent: () =>
      import('./savings-product-form.component').then((m) => m.SavingsProductFormComponent),
  },
  {
    path: 'savings/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SAVINGSPRODUCT' },
    title: 'PRODUCTS.EDIT_SAVINGS_PRODUCT',
    loadComponent: () =>
      import('./savings-product-form.component').then((m) => m.SavingsProductFormComponent),
  },
  {
    path: 'fixed',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FIXEDDEPOSITPRODUCT' },
    title: 'nav.fixedDepositProducts',
    loadComponent: () =>
      import('./fixed-deposits/fixed-deposit-products-list.component').then(
        (m) => m.FixedDepositProductsListComponent,
      ),
  },
  {
    path: 'fixed/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FIXEDDEPOSITPRODUCT' },
    title: 'PRODUCTS.CREATE_FIXED_DEPOSIT_PRODUCT',
    loadComponent: () =>
      import('./fixed-deposits/fixed-deposit-product-form.component').then(
        (m) => m.FixedDepositProductFormComponent,
      ),
  },
  {
    path: 'fixed/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FIXEDDEPOSITPRODUCT' },
    title: 'PRODUCTS.EDIT_FIXED_DEPOSIT_PRODUCT',
    loadComponent: () =>
      import('./fixed-deposits/fixed-deposit-product-form.component').then(
        (m) => m.FixedDepositProductFormComponent,
      ),
  },
  {
    path: 'recurring',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_RECURRINGDEPOSITPRODUCT' },
    title: 'nav.recurringDepositProducts',
    loadComponent: () =>
      import('./recurring-deposits/recurring-deposit-products-list.component').then(
        (m) => m.RecurringDepositProductsListComponent,
      ),
  },
  {
    path: 'recurring/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_RECURRINGDEPOSITPRODUCT' },
    title: 'PRODUCTS.CREATE_RECURRING_DEPOSIT_PRODUCT',
    loadComponent: () =>
      import('./recurring-deposits/recurring-deposit-product-form.component').then(
        (m) => m.RecurringDepositProductFormComponent,
      ),
  },
  {
    path: 'recurring/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_RECURRINGDEPOSITPRODUCT' },
    title: 'PRODUCTS.EDIT_RECURRING_DEPOSIT_PRODUCT',
    loadComponent: () =>
      import('./recurring-deposits/recurring-deposit-product-form.component').then(
        (m) => m.RecurringDepositProductFormComponent,
      ),
  },
  {
    path: 'share',
    title: 'nav.shareProducts',
    loadComponent: () =>
      import('./shares/share-products-list.component').then((m) => m.ShareProductsListComponent),
  },
  {
    path: 'share/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_SHAREPRODUCT' },
    title: 'PRODUCTS.CREATE_SHARE_PRODUCT',
    loadComponent: () =>
      import('./shares/share-product-form.component').then((m) => m.ShareProductFormComponent),
  },
  {
    path: 'share/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SHAREPRODUCT' },
    title: 'PRODUCTS.EDIT_SHARE_PRODUCT',
    loadComponent: () =>
      import('./shares/share-product-form.component').then((m) => m.ShareProductFormComponent),
  },
  {
    path: 'tax-components',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_TAXCOMPONENT' },
    title: 'nav.taxComponents',
    loadComponent: () =>
      import('./tax-components/tax-components-list.component').then(
        (m) => m.TaxComponentsListComponent,
      ),
  },
  {
    path: 'tax-components/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_TAXCOMPONENT' },
    title: 'TAX_COMPONENTS.CREATE',
    loadComponent: () =>
      import('./tax-components/tax-component-form.component').then(
        (m) => m.TaxComponentFormComponent,
      ),
  },
  {
    path: 'tax-components/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_TAXCOMPONENT' },
    title: 'TAX_COMPONENTS.EDIT',
    loadComponent: () =>
      import('./tax-components/tax-component-form.component').then(
        (m) => m.TaxComponentFormComponent,
      ),
  },
  {
    path: 'tax-groups',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_TAXGROUP' },
    title: 'nav.taxGroups',
    loadComponent: () =>
      import('./tax-groups/tax-groups-list.component').then((m) => m.TaxGroupsListComponent),
  },
  {
    path: 'tax-groups/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_TAXGROUP' },
    title: 'TAX_GROUPS.CREATE',
    loadComponent: () =>
      import('./tax-groups/tax-group-form.component').then((m) => m.TaxGroupFormComponent),
  },
  {
    path: 'tax-groups/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_TAXGROUP' },
    title: 'TAX_GROUPS.EDIT',
    loadComponent: () =>
      import('./tax-groups/tax-group-form.component').then((m) => m.TaxGroupFormComponent),
  },
  {
    path: 'floating-rates',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FLOATINGRATE' },
    title: 'nav.floatingRates',
    loadComponent: () =>
      import('./floating-rates/floating-rates-list.component').then(
        (m) => m.FloatingRatesListComponent,
      ),
  },
  {
    path: 'floating-rates/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FLOATINGRATE' },
    title: 'FLOATING_RATES.CREATE',
    loadComponent: () =>
      import('./floating-rates/floating-rate-form.component').then(
        (m) => m.FloatingRateFormComponent,
      ),
  },
  {
    path: 'floating-rates/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FLOATINGRATE' },
    title: 'FLOATING_RATES.EDIT',
    loadComponent: () =>
      import('./floating-rates/floating-rate-form.component').then(
        (m) => m.FloatingRateFormComponent,
      ),
  },
  {
    path: 'savings-accounts',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SAVINGSACCOUNT' },
    title: 'nav.savingsAccounts',
    loadComponent: () =>
      import('./savings-accounts-list.component').then((m) => m.SavingsAccountsListComponent),
  },
  {
    path: 'savings-accounts/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_SAVINGSACCOUNT' },
    title: 'SAVINGS.CREATE_ACCOUNT',
    loadComponent: () =>
      import('./savings-account-form.component').then((m) => m.SavingsAccountFormComponent),
  },
  {
    path: 'savings-accounts/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SAVINGSACCOUNT' },
    title: 'SAVINGS.EDIT_ACCOUNT',
    loadComponent: () =>
      import('./savings-account-form.component').then((m) => m.SavingsAccountFormComponent),
  },
  {
    path: 'savings-accounts/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SAVINGSACCOUNT' },
    title: 'SAVINGS.ACCOUNT_DETAILS',
    loadComponent: () =>
      import('./savings-account-view.component').then((m) => m.SavingsAccountViewComponent),
  },
  {
    path: 'savings-accounts/:accountId/transactions/:command',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SAVINGSACCOUNT' },
    title: 'SAVINGS.TRANSACTION',
    loadComponent: () =>
      import('./savings-account-transaction-form.component').then(
        (m) => m.SavingsAccountTransactionFormComponent,
      ),
  },
  {
    path: 'fixed-deposits',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FIXEDDEPOSITACCOUNT' },
    title: 'nav.fixedDeposits',
    loadComponent: () =>
      import('./fixed-deposits/fixed-deposits-list.component').then(
        (m) => m.FixedDepositAccountsListComponent,
      ),
  },
  {
    path: 'fixed-deposits/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FIXEDDEPOSITACCOUNT' },
    title: 'FIXED_DEPOSITS.CREATE',
    loadComponent: () =>
      import('./fixed-deposits/fixed-deposit-form.component').then(
        (m) => m.FixedDepositAccountFormComponent,
      ),
  },
  {
    path: 'fixed-deposits/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FIXEDDEPOSITACCOUNT' },
    title: 'FIXED_DEPOSITS.EDIT',
    loadComponent: () =>
      import('./fixed-deposits/fixed-deposit-form.component').then(
        (m) => m.FixedDepositAccountFormComponent,
      ),
  },
  {
    path: 'fixed-deposits/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FIXEDDEPOSITACCOUNT' },
    title: 'FIXED_DEPOSITS.ACCOUNT_DETAILS',
    loadComponent: () =>
      import('./deposit-account-view.component').then((m) => m.DepositAccountViewComponent),
  },
  {
    path: 'recurring-deposits',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_RECURRINGDEPOSITACCOUNT' },
    title: 'nav.recurringDeposits',
    loadComponent: () =>
      import('./recurring-deposits/recurring-deposits-list.component').then(
        (m) => m.RecurringDepositsListComponent,
      ),
  },
  {
    path: 'recurring-deposits/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_RECURRINGDEPOSITACCOUNT' },
    title: 'RECURRING_DEPOSITS.CREATE',
    loadComponent: () =>
      import('./recurring-deposits/recurring-deposit-form.component').then(
        (m) => m.RecurringDepositAccountFormComponent,
      ),
  },
  {
    path: 'recurring-deposits/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_RECURRINGDEPOSITACCOUNT' },
    title: 'RECURRING_DEPOSITS.EDIT',
    loadComponent: () =>
      import('./recurring-deposits/recurring-deposit-form.component').then(
        (m) => m.RecurringDepositAccountFormComponent,
      ),
  },
  {
    path: 'recurring-deposits/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_RECURRINGDEPOSITACCOUNT' },
    title: 'RECURRING_DEPOSITS.ACCOUNT_DETAILS',
    loadComponent: () =>
      import('./deposit-account-view.component').then((m) => m.DepositAccountViewComponent),
  },
  {
    path: 'shares',
    title: 'nav.shares',
    loadComponent: () =>
      import('./shares/share-accounts-list.component').then((m) => m.ShareAccountsListComponent),
  },
  {
    path: 'shares/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_SHAREACCOUNT' },
    title: 'SHARE_ACCOUNTS.CREATE',
    loadComponent: () =>
      import('./shares/share-account-form.component').then((m) => m.ShareAccountFormComponent),
  },
  {
    path: 'shares/view/:id',
    title: 'SHARE_ACCOUNTS.ACCOUNT_DETAILS',
    loadComponent: () =>
      import('./shares/share-account-view.component').then((m) => m.ShareAccountViewComponent),
  },
  {
    path: 'shares/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SHAREACCOUNT' },
    title: 'SHARE_ACCOUNTS.EDIT',
    loadComponent: () =>
      import('./shares/share-account-form.component').then((m) => m.ShareAccountFormComponent),
  },
  {
    path: ':accountType/:accountId/action/:command',
    title: 'ACTIONS.ACCOUNT_ACTION',
    loadComponent: () =>
      import('./account-action-form.component').then((m) => m.AccountActionFormComponent),
  },
  {
    path: 'rates',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_RATE' },
    title: 'nav.rates',
    loadComponent: () => import('./rates/rates-list.component').then((m) => m.RatesListComponent),
  },
  {
    path: 'rates/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_RATE' },
    title: 'RATES.CREATE',
    loadComponent: () => import('./rates/rate-form.component').then((m) => m.RateFormComponent),
  },
  {
    path: 'rates/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_RATE' },
    title: 'RATES.EDIT',
    loadComponent: () => import('./rates/rate-form.component').then((m) => m.RateFormComponent),
  },
  {
    path: 'interest-rate-charts',
    title: 'nav.interestRateCharts',
    loadComponent: () =>
      import('./interest-rate-charts/interest-rate-charts-list.component').then(
        (m) => m.InterestRateChartsListComponent,
      ),
  },
  {
    path: 'interest-rate-charts/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_INTERESTRATECHART' },
    title: 'INTEREST_RATE_CHARTS.CREATE',
    loadComponent: () =>
      import('./interest-rate-charts/interest-rate-chart-form.component').then(
        (m) => m.InterestRateChartFormComponent,
      ),
  },
  {
    path: 'interest-rate-charts/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_INTERESTRATECHART' },
    title: 'INTEREST_RATE_CHARTS.EDIT',
    loadComponent: () =>
      import('./interest-rate-charts/interest-rate-chart-form.component').then(
        (m) => m.InterestRateChartFormComponent,
      ),
  },
  {
    path: 'interest-rate-charts/:chartId/slabs',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_CHARTSLAB' },
    title: 'INTEREST_RATE_CHARTS.SLABS',
    loadComponent: () =>
      import('./interest-rate-charts/interest-rate-chart-slabs.component').then(
        (m) => m.InterestRateChartSlabsComponent,
      ),
  },
  {
    path: 'loan/:productId/product-mix',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_PRODUCTMIX' },
    title: 'PRODUCT_MIX.TITLE',
    loadComponent: () =>
      import('./product-mix/product-mix.component').then((m) => m.ProductMixComponent),
  },
  {
    path: 'savings-accounts/:savingsAccountId/charges',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SAVINGSACCOUNT' },
    title: 'SAVINGS_CHARGES.TITLE',
    loadComponent: () =>
      import('./savings-charges/savings-charges-list.component').then(
        (m) => m.SavingsChargesListComponent,
      ),
  },
  {
    path: 'savings-accounts/:savingsAccountId/charges/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SAVINGSACCOUNT' },
    title: 'SAVINGS_CHARGES.CREATE',
    loadComponent: () =>
      import('./savings-charges/savings-charge-form.component').then(
        (m) => m.SavingsChargeFormComponent,
      ),
  },
  {
    path: 'shares/:productId/dividends',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_DIVIDEND_SHAREPRODUCT' },
    title: 'SHARE_DIVIDENDS.TITLE',
    loadComponent: () =>
      import('./share-dividends/share-dividends-list.component').then(
        (m) => m.ShareDividendsListComponent,
      ),
  },
  {
    path: 'shares/:productId/dividends/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_DIVIDEND_SHAREPRODUCT' },
    title: 'SHARE_DIVIDENDS.CREATE',
    loadComponent: () =>
      import('./share-dividends/share-dividend-form.component').then(
        (m) => m.ShareDividendFormComponent,
      ),
  },
  {
    path: 'fixed-deposits/:accountId/transactions',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FIXEDDEPOSITACCOUNT' },
    title: 'FIXED_DEPOSIT_TRANSACTIONS.TITLE',
    loadComponent: () =>
      import('./fixed-deposit-transactions/fixed-deposit-transactions-list.component').then(
        (m) => m.FixedDepositTransactionsListComponent,
      ),
  },
  // Deposit only — the platform refuses a withdrawal on a fixed deposit, so there is no
  // `:command` segment to switch on. See the form's own documentation.
  {
    path: 'fixed-deposits/:accountId/transactions/deposit',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FIXEDDEPOSITACCOUNT' },
    title: 'FIXED_DEPOSIT_TRANSACTIONS.DEPOSIT',
    loadComponent: () =>
      import('./fixed-deposit-transactions/fixed-deposit-transaction-form.component').then(
        (m) => m.FixedDepositTransactionFormComponent,
      ),
  },
  {
    path: 'recurring-deposits/:accountId/transactions/:command',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_RECURRINGDEPOSITACCOUNT' },
    title: 'RECURRING_DEPOSIT_TRANSACTIONS.CREATE',
    loadComponent: () =>
      import('./recurring-deposit-transactions/recurring-deposit-transaction-form.component').then(
        (m) => m.RecurringDepositTransactionFormComponent,
      ),
  },
  {
    path: 'savings-accounts/:savingsId/on-hold-transactions',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SAVINGSACCOUNT' },
    title: 'ON_HOLD_TRANSACTIONS.TITLE',
    loadComponent: () =>
      import('./on-hold-transactions/on-hold-transactions-list.component').then(
        (m) => m.OnHoldTransactionsListComponent,
      ),
  },
  {
    path: 'loan-originators',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN_ORIGINATOR' },
    title: 'nav.loanOriginators',
    loadComponent: () =>
      import('./loan-originators/loan-originators-list.component').then(
        (m) => m.LoanOriginatorsListComponent,
      ),
  },
  {
    path: 'loan-originators/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_LOAN_ORIGINATOR' },
    title: 'LOAN_ORIGINATORS.CREATE',
    loadComponent: () =>
      import('./loan-originators/loan-originator-form.component').then(
        (m) => m.LoanOriginatorFormComponent,
      ),
  },
  {
    path: 'loan-originators/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_LOAN_ORIGINATOR' },
    title: 'LOAN_ORIGINATORS.EDIT',
    loadComponent: () =>
      import('./loan-originators/loan-originator-form.component').then(
        (m) => m.LoanOriginatorFormComponent,
      ),
  },
  {
    path: 'collateral-management',
    title: 'nav.collateralManagement',
    loadComponent: () =>
      import('./collateral-management/collateral-management-list.component').then(
        (m) => m.CollateralManagementListComponent,
      ),
  },
  {
    path: 'collateral-management/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_COLLATERAL_PRODUCT' },
    title: 'COLLATERAL_MANAGEMENT.CREATE',
    loadComponent: () =>
      import('./collateral-management/collateral-management-form.component').then(
        (m) => m.CollateralManagementFormComponent,
      ),
  },
  {
    path: 'collateral-management/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_COLLATERAL_PRODUCT' },
    title: 'COLLATERAL_MANAGEMENT.EDIT',
    loadComponent: () =>
      import('./collateral-management/collateral-management-form.component').then(
        (m) => m.CollateralManagementFormComponent,
      ),
  },
];
