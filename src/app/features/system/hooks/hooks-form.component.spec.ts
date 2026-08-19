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
import { HooksFormComponent } from './hooks-form.component';
import { HooksService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('HooksFormComponent', () => {
  let component: HooksFormComponent;
  let fixture: ComponentFixture<HooksFormComponent>;
  let serviceSpy: jasmine.SpyObj<HooksService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('HooksService', [
      'getHooksTemplate',
      'getHooksHookId',
      'postHooks',
      'putHooksHookId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getHooksTemplate.and.returnValue(
      of({ templates: [{ id: 1, name: 'Web' }] }) as unknown as ReturnType<
        HooksService['getHooksTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [HooksFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: HooksService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HooksFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getHooksTemplate).toHaveBeenCalled();
    expect(component.templateOptions()).toHaveSize(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postHooks.and.returnValue(
      of({}) as unknown as ReturnType<HooksService['postHooks']>,
    );
    component.hook.set({ name: 'Web', displayName: 'New', isActive: true });
    component.onSubmit();
    expect(serviceSpy.postHooks).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/hooks']);
  });
});
