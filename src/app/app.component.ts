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

import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18N } from './core/adapters';
import { IdleService } from './core/services/idle.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly i18n = inject(I18N);
  private readonly idleService = inject(IdleService);
  protected readonly title = signal('fineract-backoffice-ui');

  constructor() {
    this.i18n.registerLangs(['en', 'hi', 'ko']);
    this.i18n.setFallbackLang('en');

    const browserLang = this.i18n.detectBrowserLang();
    this.i18n.use(browserLang ?? 'en');
  }

  switchLanguage(lang: string) {
    this.i18n.use(lang);
  }
}
