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
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CodeFormComponent } from './code-form.component';
import { CodesService } from '../../../api';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('CodeFormComponent', () => {
  let component: CodeFormComponent;
  let fixture: ComponentFixture<CodeFormComponent>;
  let codesServiceSpy: SpyObj<CodesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    codesServiceSpy = createSpyObj(['getCodesCodeId', 'postCodes', 'putCodesCodeId']);
    routerSpy = createSpyObj(['navigate']);

    codesServiceSpy.getCodesCodeId.mockReturnValue(
      of({ id: 1, name: 'Customer Type', isSystemDefined: false }) as unknown as ReturnType<
        CodesService['getCodesCodeId']
      >,
    );
    codesServiceSpy.postCodes.mockReturnValue(
      of({ resourceId: 2 }) as unknown as ReturnType<CodesService['postCodes']>,
    );
    codesServiceSpy.putCodesCodeId.mockReturnValue(
      of({ resourceId: 1 }) as unknown as ReturnType<CodesService['putCodesCodeId']>,
    );

    await TestBed.configureTestingModule({
      imports: [CodeFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: CodesService, useValue: codesServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component in create mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
  });

  it('navigates away on cancel', () => {
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/codes']);
  });

  it('submits valid code draft in create mode', () => {
    component.code.set({ name: 'New Code' });
    component.onSubmit();
    expect(codesServiceSpy.postCodes).toHaveBeenCalledWith({ name: 'New Code' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/codes']);
  });

  describe('required-field feedback (#585)', () => {
    it('marks required name field with asterisk', () => {
      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      const markerCount = (html.match(/class="required-marker"/g) ?? []).length;
      expect(markerCount).toBe(1);
    });

    it('shows no field error until user touches the field', () => {
      expect(fixture.nativeElement.querySelector('[data-testid="code-name-error"]')).toBeNull();
    });

    it('shows required error once empty name field is blurred', () => {
      const input = fixture.nativeElement.querySelector('#code-name-input')!;
      input.dispatchEvent(new CustomEvent('ionBlur'));
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[data-testid="code-name-error"]');
      expect(error).not.toBeNull();
      expect(error!.textContent).toContain('COMMON.REQUIRED');
    });

    it('hides field error once value is entered', () => {
      const input = fixture.nativeElement.querySelector('#code-name-input')!;
      input.dispatchEvent(new CustomEvent('ionBlur'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="code-name-error"]')).not.toBeNull();

      (input as HTMLInputElement).value = 'ValidCode';
      input.dispatchEvent(new CustomEvent('ionInput'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="code-name-error"]')).toBeNull();
    });

    it('shows submit hint while form is incomplete', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('[data-testid="code-submit-hint"]');
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toContain('COMMON.COMPLETE_REQUIRED_FIELDS');
    });
  });
});
