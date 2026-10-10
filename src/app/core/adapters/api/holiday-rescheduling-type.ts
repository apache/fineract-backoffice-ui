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
 * How a holiday reschedules the repayments it displaces.
 *
 * In a module of its own, with no imports, because both {@link HolidayApi} and the Fineract
 * adapter need it **at runtime**. The contract imports the adapter for its injection-token
 * factory, so an adapter that imported a value back from the contract would close a real
 * circular dependency — the kind that resolves to `undefined` at module-evaluation time rather
 * than failing loudly. The other contracts in this directory get only *types* back, which erase.
 *
 * Fineract's `reschedulingType`, as the two values it actually accepts. The holiday form had
 * the meanings right but expressed them as a bare `2`, and recovered the mapping from whether
 * `repaymentsRescheduledTo` happened to be set.
 */
export const RESCHEDULING_TYPE = {
  NextRepaymentDate: 1,
  SpecifiedDate: 2,
} as const;

export type ReschedulingType = (typeof RESCHEDULING_TYPE)[keyof typeof RESCHEDULING_TYPE];
