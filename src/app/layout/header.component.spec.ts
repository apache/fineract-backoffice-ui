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
import { HeaderComponent } from './header.component';
import { AuthService } from '../core/services/auth.service';
import { NavigationConfigService } from '../core/services/navigation-config.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { signal } from '@angular/core';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let navigationConfigSpy: jasmine.SpyObj<NavigationConfigService>;
  let translateService: TranslateService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout'], {
      username: signal('mifos'),
      officeName: signal('Head Office'),
    });
    navigationConfigSpy = jasmine.createSpyObj('NavigationConfigService', ['searchRoutes']);
    navigationConfigSpy.searchRoutes.and.returnValue([]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), HeaderComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NavigationConfigService, useValue: navigationConfigSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    translateService = TestBed.inject(TranslateService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display username and office', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.username')?.textContent).toContain('mifos');
    expect(compiled.querySelector('.office')?.textContent).toContain('Head Office');
  });

  it('should call logout and navigate', () => {
    component.logout();
    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should switch language', () => {
    spyOn(translateService, 'use');
    component.switchLanguage('hi');
    expect(translateService.use).toHaveBeenCalledWith('hi');
  });
});
