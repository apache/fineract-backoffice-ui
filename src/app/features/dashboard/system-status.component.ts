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

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { ConfigService } from '../../core/services/config.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Dashboard component that displays the current operational status of the application.
 *
 * Shows the active API endpoint (both runtime and fallback), the current environment
 * (Production/Development), and the active tenant.
 */
@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="card">
      <h3>{{ 'dashboard.systemStatus' | translate }}</h3>
      <ul>
        <li><strong>Runtime API URL:</strong> {{ configService.apiUrl }}</li>
        <li><strong>Fallback API URL:</strong> {{ environmentUrl }}</li>
        <li><strong>Environment:</strong> {{ isProd ? 'Production' : 'Development' }}</li>
        <li><strong>Tenant:</strong> {{ currentTenant() }}</li>
      </ul>
    </div>
  `,
  styles: [],
})
export class SystemStatusComponent {
  /** The runtime configuration service */
  protected readonly configService = inject(ConfigService);
  /** The authentication service supplying the active tenant */
  private readonly authService = inject(AuthService);
  /** The hardcoded environment API URL for reference */
  protected readonly environmentUrl = environment.fineractApiUrl;
  /** Boolean flag indicating if the app is in production mode */
  protected readonly isProd = environment.production;
  /** Signal containing the current active tenant identifier */
  protected readonly currentTenant = this.authService.currentTenantId;
}
