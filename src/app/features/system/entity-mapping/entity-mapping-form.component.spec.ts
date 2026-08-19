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
import { EntityMappingFormComponent } from './entity-mapping-form.component';
import { FineractEntityService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('EntityMappingFormComponent', () => {
  let component: EntityMappingFormComponent;
  let fixture: ComponentFixture<EntityMappingFormComponent>;
  let serviceSpy: jasmine.SpyObj<FineractEntityService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('FineractEntityService', [
      'getEntitytoentitymappingMapId',
      'postEntitytoentitymappingRelId',
      'putEntitytoentitymappingMapId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [EntityMappingFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: FineractEntityService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntityMappingFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should post a stringified body on create and navigate to the list', () => {
    serviceSpy.postEntitytoentitymappingRelId.and.returnValue(
      of('{}') as unknown as ReturnType<FineractEntityService['postEntitytoentitymappingRelId']>,
    );
    component.relId.set(1);
    component.payload.set({ fromId: 10, toId: 20 });
    component.onSubmit();
    expect(serviceSpy.postEntitytoentitymappingRelId).toHaveBeenCalledWith(
      1,
      JSON.stringify({ fromId: 10, toId: 20 }),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/entity-mapping']);
  });
});
