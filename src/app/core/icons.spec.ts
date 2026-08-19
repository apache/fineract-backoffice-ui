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

import { APP_ICONS } from './icons';

describe('APP_ICONS', () => {
  it('resolves every entry to ionicon SVG data', () => {
    const broken = Object.entries(APP_ICONS).filter(
      ([, data]) => typeof data !== 'string' || !data.startsWith('data:image/svg+xml'),
    );

    expect(broken.map(([name]) => name)).toEqual([]);
  });

  it('keys are kebab-case, matching the ion-icon name attribute', () => {
    // The detector flags the nested quantifier below, but the mandatory '-' between groups
    // makes backtracking linear, and the input is this file's own icon-name keys rather than
    // anything a user supplies.
    const malformed = Object.keys(APP_ICONS).filter(
      // eslint-disable-next-line security/detect-unsafe-regex
      (name) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name),
    );

    expect(malformed).toEqual([]);
  });

  it('registers the icons the shared components and layout depend on', () => {
    // A regression guard for the icons that would otherwise fail silently as blank glyphs.
    const required = [
      'create-outline',
      'trash-outline',
      'add-outline',
      'eye-outline',
      'search-outline',
      'help-circle-outline',
      'warning-outline',
      'menu-outline',
      'moon-outline',
      'sunny-outline',
      'arrow-back-outline',
      'arrow-up-outline',
      'arrow-down-outline',
    ];

    expect(required.filter((name) => !(name in APP_ICONS))).toEqual([]);
  });
});
