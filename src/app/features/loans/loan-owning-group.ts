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

/** The group a group loan belongs to. */
export interface LoanOwningGroup {
  id: number;
  name: string;
}

/**
 * The group that owns a group loan. The loan response carries it under `group`, with `clientId`
 * and `clientName` null, and the generated model does not declare it, so each field is checked
 * rather than assumed.
 */
export function readOwningGroup(data: object): LoanOwningGroup | null {
  const group = 'group' in data ? data.group : undefined;
  return typeof group === 'object' &&
    group !== null &&
    'id' in group &&
    typeof group.id === 'number' &&
    'name' in group &&
    typeof group.name === 'string' &&
    group.name.trim().length > 0
    ? { id: group.id, name: group.name }
    : null;
}
