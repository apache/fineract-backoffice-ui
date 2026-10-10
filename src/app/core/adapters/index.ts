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
 * Adapter boundary — the seam between this application and the third-party libraries it
 * renders and speaks with. See `DOCS/adr/0003-adapter-boundary.md`.
 *
 * Application code imports the contracts and tokens from here. The `*-*.adapter.ts`
 * implementation files are the only places permitted to import the underlying library, and
 * `eslint.config.js` enforces that.
 */

export * from './i18n/i18n.adapter';
export * from './i18n/translate.pipe';
export * from './overlay/overlay.adapter';
export * from './download/download.adapter';
export * from './storage/storage.adapter';

// ADR 0006's boundary around the generated OpenAPI client. Unlike the tokens above, this one
// does not isolate a library the application might swap — the generated client stays. It
// isolates a *shape* the application does not control, regenerated on Fineract's cadence.
export * from './api/accounting-closure.api';
export * from './api/office.api';
export * from './api/entity-notes.api';
export * from './api/loan.api';
export * from './api/loan-transaction.api';
export * from './api/staff.api';
export * from './api/holiday-rescheduling-type';
export * from './api/holiday.api';
export * from './api/teller.api';
export * from './api/role.api';
export * from './api/user.api';

// The default implementations each token resolves to. Exported so a deployment swapping one
// can name what it is replacing, and so a TestBed can ask for the real thing explicitly.
// Application code should depend on the tokens above, never on these.
export { NgxTranslateI18nAdapter } from './i18n/ngx-translate-i18n.adapter';
export { IonicOverlayAdapter } from './overlay/ionic-overlay.adapter';
export { WebStorageAdapter } from './storage/web-storage.adapter';
export { BrowserDownloadAdapter } from './download/browser-download.adapter';
export { FineractAccountingClosureApi } from './api/fineract-accounting-closure.api';
export { FineractOfficeApi } from './api/fineract-office.api';
export { FineractEntityNotesApi } from './api/fineract-entity-notes.api';
export { FineractLoanApi } from './api/fineract-loan.api';
export { FineractLoanTransactionApi } from './api/fineract-loan-transaction.api';
export { FineractStaffApi } from './api/fineract-staff.api';
export { FineractHolidayApi } from './api/fineract-holiday.api';
export { FineractTellerApi } from './api/fineract-teller.api';
export { FineractRoleApi } from './api/fineract-role.api';
export { FineractUserApi } from './api/fineract-user.api';
