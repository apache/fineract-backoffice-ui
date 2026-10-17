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
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DepositChartEditorComponent } from './deposit-chart-editor.component';
import { provideTranslateTesting } from '../../testing/i18n-testing';

/**
 * The rate chart editor added by #765.
 *
 * It is the control that makes a term deposit product's rates visible, so what matters is that
 * it reports incompleteness honestly: the product forms disable their submit on
 * {@link DepositChartEditorComponent.complete}, and a false positive there puts the silent 5%
 * chart back by another route.
 */
describe('DepositChartEditorComponent', () => {
  let component: DepositChartEditorComponent;
  let fixture: ComponentFixture<DepositChartEditorComponent>;

  const PERIOD_TYPES = [
    { id: 0, code: 'periodFrequencyType.days', value: 'Days' },
    { id: 2, code: 'periodFrequencyType.months', value: 'Months' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepositChartEditorComponent],
      providers: [...provideTranslateTesting(), provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(DepositChartEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('periodTypes', PERIOD_TYPES);
    fixture.detectChanges();
  });

  function has(testId: string): boolean {
    return fixture.nativeElement.querySelector(`[data-testid="${CSS.escape(testId)}"]`) !== null;
  }

  describe('what it reports as complete', () => {
    it('is incomplete with no slabs at all', () => {
      component.slabs.set([]);

      expect(component.complete()).toBe(false);
      fixture.detectChanges();
      expect(has('chart-empty')).toBe(true);
    });

    it('is incomplete while a slab has no rate', () => {
      component.slabs.set([{ periodType: 2, fromPeriod: 1, locale: 'en' }]);

      expect(component.complete()).toBe(false);
    });

    it('is incomplete while a slab has no starting period', () => {
      component.slabs.set([{ periodType: 2, annualInterestRate: 7, locale: 'en' }]);

      expect(component.complete()).toBe(false);
    });

    it('is complete once every slab has a period and a rate', () => {
      component.slabs.set([
        { periodType: 2, fromPeriod: 1, toPeriod: 11, annualInterestRate: 5, locale: 'en' },
        { periodType: 2, fromPeriod: 12, annualInterestRate: 7, locale: 'en' },
      ]);

      expect(component.complete()).toBe(true);
    });

    it('accepts a rate of zero, which is a rate an institution may mean', () => {
      // This is why an empty field reads as undefined rather than 0: the two have to differ.
      component.slabs.set([{ periodType: 2, fromPeriod: 1, annualInterestRate: 0, locale: 'en' }]);

      expect(component.complete()).toBe(true);
    });

    it('is incomplete when one of several slabs is unfinished', () => {
      component.slabs.set([
        { periodType: 2, fromPeriod: 1, annualInterestRate: 5, locale: 'en' },
        { periodType: 2, fromPeriod: 12, locale: 'en' },
      ]);

      expect(component.complete()).toBe(false);
    });
  });

  describe('editing the slabs', () => {
    it('adds a slab with no rate, so the chart stays incomplete until one is given', () => {
      component.slabs.set([]);

      component.add();

      expect(component.slabs()).toHaveLength(1);
      expect(component.slabs()[0].annualInterestRate).toBeUndefined();
      expect(component.complete()).toBe(false);
    });

    it('removes the slab at the position asked for, not the last one', () => {
      component.slabs.set([
        { periodType: 2, fromPeriod: 1, annualInterestRate: 5, locale: 'en' },
        { periodType: 2, fromPeriod: 12, annualInterestRate: 7, locale: 'en' },
        { periodType: 2, fromPeriod: 25, annualInterestRate: 9, locale: 'en' },
      ]);

      component.remove(1);

      expect(component.slabs().map((slab) => slab.annualInterestRate)).toEqual([5, 9]);
    });

    it('patches one field of one slab, leaving the rest alone', () => {
      component.slabs.set([
        { periodType: 2, fromPeriod: 1, toPeriod: 11, annualInterestRate: 5, locale: 'en' },
        { periodType: 2, fromPeriod: 12, annualInterestRate: 7, locale: 'en' },
      ]);

      component.patch(0, { annualInterestRate: 6 });

      expect(component.slabs()[0]).toMatchObject({
        fromPeriod: 1,
        toPeriod: 11,
        annualInterestRate: 6,
      });
      expect(component.slabs()[1].annualInterestRate).toBe(7);
    });

    it('renders a row per slab, and the period types the template offered', () => {
      component.slabs.set([
        { periodType: 2, fromPeriod: 1, annualInterestRate: 5, locale: 'en' },
        { periodType: 2, fromPeriod: 12, annualInterestRate: 7, locale: 'en' },
      ]);
      fixture.detectChanges();

      expect(has('chart-slab-0')).toBe(true);
      expect(has('chart-slab-1')).toBe(true);
      const options = fixture.nativeElement.querySelectorAll(
        '[data-testid="slab-period-type-0"] option',
      );
      expect(options).toHaveLength(2);
    });
  });

  describe('reading numbers out of the inputs', () => {
    it('treats an emptied field as absent rather than as zero', () => {
      expect(component.numberOrUndefined('')).toBeUndefined();
      expect(component.numberOrUndefined(null)).toBeUndefined();
      expect(component.numberOrUndefined(undefined)).toBeUndefined();
    });

    it('keeps a real zero', () => {
      expect(component.numberOrUndefined('0')).toBe(0);
    });

    it('reads a decimal rate', () => {
      expect(component.numberOrUndefined('8.5')).toBe(8.5);
    });

    it('treats unparseable text as absent', () => {
      expect(component.numberOrUndefined('abc')).toBeUndefined();
    });
  });
});
