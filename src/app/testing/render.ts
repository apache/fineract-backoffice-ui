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

/**
 * Rendering helpers for specs.
 *
 * The suite currently cannot see the bug it most needs to catch. A field assigned from
 * an HTTP callback updates the component but never marks the view dirty, so the DOM keeps
 * the old value — the cause of the empty dropdowns in `scripts/audit-async-state.mjs`.
 * Two habits hide it:
 *
 * 1. `fixture.detectChanges()` checks the fixture's own view whether or not anything marked
 *    it dirty. A component that renders nothing in the running app renders correctly here.
 *
 * 2. Mocks return `of(value)`, which emits synchronously during construction — before the
 *    first change detection. The assignment therefore lands *ahead* of the initial render
 *    and is picked up by it, which no real HTTP response ever is.
 *
 * Both have to go, or the spec still passes against a broken component. {@link renderComponent}
 * replaces the first by awaiting stability instead of forcing a check, and {@link asyncOf}
 * replaces the second by emitting a macrotask later, the way a real response arrives.
 *
 * @example
 * ```ts
 * officesServiceSpy.getOffices.and.returnValue(asyncOf([{ id: 1, name: 'Head Office' }]));
 *
 * const fixture = await renderComponent(OfficeFormComponent, {
 *   providers: [
 *     ...provideTranslateTesting(),
 *     provideIonicTesting(),
 *     { provide: OfficesService, useValue: officesServiceSpy },
 *   ],
 * });
 *
 * // Fails while `offices` is a plain field, passes once it is a signal.
 * expect(fixture.nativeElement.querySelectorAll('ion-select-option').length).toBe(1);
 * ```
 */

import { Type } from '@angular/core';
import { ComponentFixture, TestBed, TestModuleMetadata } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

/**
 * Emits `value` asynchronously, the way an HTTP response arrives.
 *
 * `of(value)` emits synchronously, so a subscribe callback assigning a plain field runs
 * before the first change detection and its result is rendered regardless of whether the
 * component ever notified Angular. That makes the spec agree with a component the
 * application cannot render. Deferring by a macrotask restores the ordering that exposes it.
 */
export function asyncOf<T>(value: T): Observable<T> {
  return of(value).pipe(delay(0));
}

/**
 * Creates a component and lets it render the way the application would.
 *
 * `autoDetectChanges()` checks the view when Angular schedules a tick, and only then —
 * the same rule the running app follows. That is the whole point: a component that
 * updates state without notifying Angular schedules no tick, so the DOM stays stale and
 * the assertion fails, instead of being rescued by a `detectChanges()` the app never makes.
 *
 * The initial render is not the interesting case — the app performs one too, and
 * `ngOnInit` runs as part of it. What must be earned is every update after it, which is
 * why mocks should emit through {@link asyncOf} rather than synchronously.
 *
 * Prefer this over `createComponent` + `detectChanges` in new specs.
 */
export async function renderComponent<T>(
  component: Type<T>,
  config: TestModuleMetadata = {},
): Promise<ComponentFixture<T>> {
  const { imports = [], providers = [], ...rest } = config;

  await TestBed.configureTestingModule({
    imports: [component, ...(imports as unknown[])],
    providers,
    ...rest,
  }).compileComponents();

  const fixture = TestBed.createComponent(component);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}
