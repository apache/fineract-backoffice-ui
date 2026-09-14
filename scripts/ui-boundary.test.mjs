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

import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
async function importErrors(filePath, module, symbol) {
  const [result] = await eslint.lintText(
    `import { ${symbol} } from '${module}'; export const imported = ${symbol};`,
    { filePath },
  );
  return result.messages.filter((message) => message.ruleId === 'no-restricted-imports');
}

test('new feature Ionic imports are rejected without suppression', async () => {
  assert.equal(
    (await importErrors('src/app/features/probe.ts', '@ionic/angular/standalone', 'IonButton'))
      .length,
    1,
  );
});
test('UI implementations may use Ionic but cannot bypass other adapter boundaries', async () => {
  assert.equal(
    (await importErrors('src/app/ui/probe.ts', '@ionic/angular/standalone', 'IonButton')).length,
    0,
  );
  assert.equal(
    (await importErrors('src/app/ui/probe.ts', '@angular/material/button', 'MatButton')).length,
    1,
  );
  assert.equal(
    (await importErrors('src/app/ui/probe.ts', '@ngx-translate/core', 'TranslateService')).length,
    1,
  );
});
test('the existing composition roots and imperative adapter remain allowed', async () => {
  for (const file of [
    'src/app/app.config.ts',
    'src/app/testing/ionic-testing.ts',
    'src/app/core/adapters/overlay/ionic-overlay.adapter.ts',
  ]) {
    assert.equal((await importErrors(file, '@ionic/angular/standalone', 'IonButton')).length, 0);
  }
});
