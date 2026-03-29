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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SystemStatusComponent } from './system-status.component';
import { TranslateModule } from '@ngx-translate/core';
import { ConfigService } from '../../core/services/config.service';
import { AuthService } from '../../core/services/auth.service';

describe('SystemStatusComponent', () => {
  let component: SystemStatusComponent;
  let fixture: ComponentFixture<SystemStatusComponent>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    configServiceSpy = jasmine.createSpyObj('ConfigService', [], {
      apiUrl: 'https://localhost:8443/fineract-provider/api/v1',
    });
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentTenantId: signal('tenant-a'),
    });

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), SystemStatusComponent],
      providers: [
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SystemStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display environment information', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const listItems = compiled.querySelectorAll('li');
    expect(listItems.length).toBe(4);
    expect(compiled.textContent).toContain('Runtime API URL:');
    expect(compiled.textContent).toContain('Fallback API URL:');
    expect(compiled.textContent).toContain('Environment:');
    expect(compiled.textContent).toContain('Tenant:');
    expect(compiled.textContent).toContain('tenant-a');
  });
});
