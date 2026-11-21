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

import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18N } from '../../core/adapters/i18n/i18n.adapter';

@Pipe({
  name: 'dateTime',
  standalone: true,
  pure: false,
})
export class DateTimePipe implements PipeTransform {
  private readonly i18n = inject(I18N);

  private memoKey: string | null = null;
  private memoValue = '';

  transform(value: Date | string | number | null | undefined): string {
    if (value == null || value === '') return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const memoKey = `${this.i18n.currentLang()}${date.getTime()}`;
    if (memoKey !== this.memoKey) {
      this.memoKey = memoKey;
      this.memoValue = new Intl.DateTimeFormat(this.mapIntlLocale(this.i18n.currentLang()), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      }).format(date);
    }
    return this.memoValue;
  }

  private mapIntlLocale(lang: string): string {
    const map: Record<string, string> = {
      en: 'en-US',
      hi: 'hi-IN',
      ko: 'ko-KR',
      fr: 'fr-FR',
      es: 'es-ES',
    };
    return map[lang] || lang || 'en-US';
  }
}
