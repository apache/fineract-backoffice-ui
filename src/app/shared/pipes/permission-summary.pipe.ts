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

import { Pipe, PipeTransform } from '@angular/core';

/**
 * Fineract permission codes are `VERB_ENTITY`. These are the verbs worth naming; the platform
 * defines 151 of them, and the long tail is compound operations whose code reads better as
 * itself than as anything this map could invent for it.
 */
const VERBS: Readonly<Record<string, string>> = {
  READ: 'view',
  CREATE: 'create',
  UPDATE: 'edit',
  DELETE: 'delete',
  ACTIVATE: 'activate',
  CLOSE: 'close',
  APPROVE: 'approve',
  REJECT: 'reject',
  WITHDRAW: 'withdraw',
  REACTIVATE: 'reactivate',
  DISBURSE: 'disburse',
  DEPOSIT: 'pay into',
  REPAYMENT: 'take repayments on',
  WAIVE: 'waive',
  PAY: 'pay',
  WRITEOFF: 'write off',
  CHARGEOFF: 'charge off',
  EXECUTE: 'run',
  EXECUTEJOB: 'run',
  ASSIGNSTAFF: 'assign staff to',
  UNASSIGNSTAFF: 'unassign staff from',
  BULKREASSIGN: 'reassign',
  REGISTER: 'register',
  PERMISSIONS: 'change permissions on',
};

/**
 * Entities whose code does not read as English on its own. Anything absent falls back to the
 * lower-cased code, which for `CLIENT`, `CHARGE` or `HOLIDAY` is already right.
 */
const ENTITIES: Readonly<Record<string, string>> = {
  GLACCOUNT: 'ledger accounts',
  GLCLOSURE: 'accounting closures',
  JOURNALENTRY: 'journal entries',
  ACCOUNTINGRULE: 'accounting rules',
  FINANCIALACTIVITYACCOUNT: 'financial activity mappings',
  SAVINGSACCOUNT: 'savings accounts',
  FIXEDDEPOSITACCOUNT: 'fixed deposit accounts',
  RECURRINGDEPOSITACCOUNT: 'recurring deposit accounts',
  SHAREACCOUNT: 'share accounts',
  LOANPRODUCT: 'loan products',
  SAVINGSPRODUCT: 'savings products',
  FIXEDDEPOSITPRODUCT: 'fixed deposit products',
  RECURRINGDEPOSITPRODUCT: 'recurring deposit products',
  SHAREPRODUCT: 'share products',
  ACCOUNTTRANSFER: 'account transfers',
  STANDINGINSTRUCTION: 'standing instructions',
  LOANCHARGE: 'loan charges',
  CLIENTCHARGE: 'client charges',
  CLIENTNOTE: 'client notes',
  GROUPNOTE: 'group notes',
  LOANNOTE: 'loan notes',
  CLIENTIDENTIFIER: 'client identifiers',
  FAMILYMEMBERS: 'family members',
  DATATABLE: 'data tables',
  CODEVALUE: 'code values',
  PAYMENTTYPE: 'payment types',
  ACCOUNTNUMBERFORMAT: 'account number formats',
  OFFICETRANSACTION: 'office transactions',
  REPORTMAILINGJOB: 'report mailing jobs',
  ENTITY_DATATABLE_CHECK: 'data table checks',
  DELINQUENCY_BUCKET: 'delinquency buckets',
  DELINQUENCY_RANGE: 'delinquency ranges',
  BUSINESS_DATE: 'business dates',
  PASSWORD_PREFERENCES: 'password preferences',
  TWOFACTOR_CONFIGURATION: 'two-factor configuration',
  EMAIL_CONFIGURATION: 'email configuration',
  EXTERNAL_EVENT_CONFIGURATION: 'external event configuration',
  CREDITBUREAU_CONFIGURATION: 'credit bureau configuration',
  BATCH_BUSINESS_STEP: 'business steps',
  LOAN_ORIGINATOR: 'loan originators',
  RESCHEDULELOAN: 'loan reschedule requests',
  INTEREST_PAUSE: 'interest pauses',
  WORKINGCAPITALLOAN: 'working capital loans',
  WORKINGCAPITALLOANPRODUCT: 'working capital loan products',
  WORKINGCAPITALBREACH: 'working capital breaches',
  WORKINGCAPITALNEARBREACH: 'working capital near-breaches',
  COLLECTIONSHEET: 'collection sheets',
  SCHEDULER: 'scheduled jobs',
  CONFIGURATION: 'global configuration',
  EXTERNALSERVICES: 'external services',
  ALL_FUNCTIONS: 'everything',
  ALL_FUNCTIONS_READ: 'everything, read-only',
};

/** Splits `CREATE_CLIENT` into its verb and entity, or returns null if it is not that shape. */
function split(code: string): { verb: string; entity: string } | null {
  const trimmed = code.trim();
  const at = trimmed.indexOf('_');
  if (at <= 0 || at === trimmed.length - 1) return null;
  return { verb: trimmed.slice(0, at), entity: trimmed.slice(at + 1) };
}

/** `GLACCOUNT` -> `ledger accounts`; `HOLIDAY` -> `holidays`; unknown shapes are left alone. */
export function describeEntity(entity: string): string {
  const known = ENTITIES[entity];
  if (known) return known;
  const words = entity.toLowerCase().replaceAll('_', ' ');
  // Naive pluralisation, which is the right trade here: these are nouns like "client",
  // "charge", "office". A wrong plural reads oddly; a missing one reads as a typo.
  return /(s|x|z|ch|sh)$/.test(words) ? `${words}es` : `${words}s`;
}

/**
 * Turns permission codes into something a person can act on.
 *
 * Codes are the currency of the platform and of any conversation with an administrator, so they
 * are never *replaced* by this — everywhere it is used, the code itself stays visible too. What
 * it adds is the ability to read the sentence without knowing the vocabulary.
 *
 * Codes sharing an entity are grouped, so `READ_CLIENT` + `CREATE_CLIENT` reads as
 * "view and create clients" rather than as two disconnected phrases.
 *
 * @param codes - permission codes, in any order
 * @returns a human-readable summary, or `''` when there is nothing to describe
 */
export function summarisePermissions(codes: readonly string[]): string {
  const byEntity = new Map<string, string[]>();
  const unrecognised: string[] = [];

  for (const code of codes) {
    // `ALL_FUNCTIONS` and `ALL_FUNCTIONS_READ` are whole answers, not verb/entity pairs.
    const whole = ENTITIES[code.trim()];
    if (whole) {
      unrecognised.push(whole);
      continue;
    }
    const parts = split(code);
    if (!parts || !VERBS[parts.verb]) {
      unrecognised.push(code.trim().toLowerCase().replaceAll('_', ' '));
      continue;
    }
    const entity = describeEntity(parts.entity);
    const verbs = byEntity.get(entity) ?? [];
    if (!verbs.includes(VERBS[parts.verb])) verbs.push(VERBS[parts.verb]);
    byEntity.set(entity, verbs);
  }

  const phrases = [...byEntity].map(([entity, verbs]) => `${joinWords(verbs)} ${entity}`);
  return capitalise(joinWords([...phrases, ...unrecognised]));
}

/** `[a, b, c]` -> `a, b and c`. */
function joinWords(words: readonly string[]): string {
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

function capitalise(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * Renders permission codes as a readable capability summary.
 *
 * ```html
 * {{ 'READ_GLACCOUNT' | permissionSummary }}          <!-- View ledger accounts -->
 * {{ ['READ_CLIENT', 'CREATE_CLIENT'] | permissionSummary }}  <!-- View and create clients -->
 * ```
 *
 * Pure: the codes are the input, so a new set is a new value and Angular re-evaluates on its own.
 */
@Pipe({ name: 'permissionSummary', standalone: true })
export class PermissionSummaryPipe implements PipeTransform {
  transform(codes: string | readonly string[] | null | undefined): string {
    if (!codes) return '';
    return summarisePermissions(typeof codes === 'string' ? [codes] : codes);
  }
}
