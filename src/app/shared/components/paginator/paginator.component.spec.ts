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
import { TranslateModule } from '@ngx-translate/core';
import { PageEvent } from '../../models/table.model';
import { PaginatorComponent } from './paginator.component';
import { provideIonicTesting } from '../../../testing/ionic-testing';

describe('PaginatorComponent', () => {
  let fixture: ComponentFixture<PaginatorComponent>;

  const rangeLabel = (): string =>
    fixture.nativeElement
      .querySelector('[data-testid="paginator-range-label"]')
      .textContent.trim()
      .replaceAll(/\s+/g, ' ');

  const setInputs = (inputs: Record<string, unknown>): void => {
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginatorComponent, TranslateModule.forRoot()],
      providers: [provideIonicTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginatorComponent);
    fixture.detectChanges();
  });

  describe('range label', () => {
    it('reports an empty range when there are no records', () => {
      setInputs({ length: 0, pageSize: 10, pageIndex: 0 });

      expect(rangeLabel()).toBe('0 of 0');
    });

    it('reports the range for the first page', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 0 });

      expect(rangeLabel()).toBe('1 - 10 of 42');
    });

    it('clamps the end of the range on the last page', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 4 });

      expect(rangeLabel()).toBe('41 - 42 of 42');
    });

    // Fineract returns offset + pageSize + 1 when it does not know the real total.
    it('renders "of many" when the total is Fineract\'s unknown-total sentinel', () => {
      setInputs({ length: 11, pageSize: 10, pageIndex: 0 });

      expect(rangeLabel()).toBe('1 - 10 of many');
    });

    it('renders a real total when it is not the sentinel', () => {
      setInputs({ length: 20, pageSize: 10, pageIndex: 1 });

      expect(rangeLabel()).toBe('11 - 20 of 20');
    });
  });

  describe('navigation', () => {
    it('disables backward navigation on the first page', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 0 });

      const first = fixture.nativeElement.querySelector('[data-testid="paginator-first"]');
      const previous = fixture.nativeElement.querySelector('[data-testid="paginator-previous"]');
      expect(first.disabled).toBeTrue();
      expect(previous.disabled).toBeTrue();
    });

    it('disables forward navigation on the last page', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 4 });

      const next = fixture.nativeElement.querySelector('[data-testid="paginator-next"]');
      const last = fixture.nativeElement.querySelector('[data-testid="paginator-last"]');
      expect(next.disabled).toBeTrue();
      expect(last.disabled).toBeTrue();
    });

    it('emits the next page when advancing', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 0 });
      let emitted: PageEvent | undefined;
      fixture.componentInstance.page.subscribe((event: PageEvent) => (emitted = event));

      fixture.nativeElement.querySelector('[data-testid="paginator-next"]').click();

      expect(emitted).toEqual({ pageIndex: 1, pageSize: 10, length: 42 });
    });

    it('jumps to the last page index', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 0 });
      let emitted: PageEvent | undefined;
      fixture.componentInstance.page.subscribe((event: PageEvent) => (emitted = event));

      fixture.nativeElement.querySelector('[data-testid="paginator-last"]').click();

      expect(emitted?.pageIndex).toBe(4);
    });

    it('does not emit when the target page is the current one', () => {
      setInputs({ length: 42, pageSize: 10, pageIndex: 0 });
      const spy = jasmine.createSpy('page');
      fixture.componentInstance.page.subscribe(spy);

      fixture.nativeElement.querySelector('[data-testid="paginator-first"]').click();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('page size', () => {
    const changePageSize = (value: number): void => {
      fixture.nativeElement
        .querySelector('[data-testid="paginator-page-size"]')
        .dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
    };

    it('keeps the first visible record in view when the page size grows', () => {
      // Records 21-30 are showing; with 25 per page that record sits on page 0.
      setInputs({ length: 100, pageSize: 10, pageIndex: 2 });
      let emitted: PageEvent | undefined;
      fixture.componentInstance.page.subscribe((event: PageEvent) => (emitted = event));

      changePageSize(25);

      expect(emitted).toEqual({ pageIndex: 0, pageSize: 25, length: 100 });
    });

    it('ignores a change to the size already in use', () => {
      setInputs({ length: 100, pageSize: 10, pageIndex: 0 });
      const spy = jasmine.createSpy('page');
      fixture.componentInstance.page.subscribe(spy);

      changePageSize(10);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
