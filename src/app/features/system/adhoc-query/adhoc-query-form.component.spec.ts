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
import { AdhocQueryFormComponent } from './adhoc-query-form.component';
import { AdhocQueryApiService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('AdhocQueryFormComponent', () => {
  let component: AdhocQueryFormComponent;
  let fixture: ComponentFixture<AdhocQueryFormComponent>;
  let serviceSpy: jasmine.SpyObj<AdhocQueryApiService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('AdhocQueryApiService', [
      'getAdhocqueryTemplate',
      'getAdhocqueryAdHocId',
      'postAdhocquery',
      'putAdhocqueryAdHocId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getAdhocqueryTemplate.and.returnValue(
      of({
        reportRunFrequencies: [{ id: 1, code: 'daily', value: 'Daily' }],
      }) as unknown as ReturnType<AdhocQueryApiService['getAdhocqueryTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [AdhocQueryFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AdhocQueryApiService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdhocQueryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getAdhocqueryTemplate).toHaveBeenCalled();
    expect(component.frequencyOptions()).toHaveSize(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postAdhocquery.and.returnValue(
      of({}) as unknown as ReturnType<AdhocQueryApiService['postAdhocquery']>,
    );
    component.query.set({ name: 'New', query: 'select 1', tableName: 't' });
    component.onSubmit();
    expect(serviceSpy.postAdhocquery).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/adhoc-query']);
  });
});
