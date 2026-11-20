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
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { WORKING_CAPITAL_LOAN_TEST_TOOLS_API } from '../../../../core/adapters';
import { provideFakeAdapters } from '../../../../testing/adapters';
import { provideTranslateTesting } from '../../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../../testing/ionic-testing';
import { WcLoanTestToolsComponent } from './wc-loan-test-tools.component';

/** Tooling for a test instance; the route that reaches it is gated by `developerToolsGuard`. */
describe('WcLoanTestToolsComponent', () => {
  let fixture: ComponentFixture<WcLoanTestToolsComponent>;
  let component: WcLoanTestToolsComponent;
  let fakes: ReturnType<typeof provideFakeAdapters>;
  let tools: {
    activate: ReturnType<typeof vi.fn>;
    regenerateAmortizationSchedule: ReturnType<typeof vi.fn>;
    generateNextDelinquencyPeriod: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    fakes = provideFakeAdapters();
    tools = {
      activate: vi.fn().mockReturnValue(of(undefined)),
      regenerateAmortizationSchedule: vi.fn().mockReturnValue(of(undefined)),
      generateNextDelinquencyPeriod: vi.fn().mockReturnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [WcLoanTestToolsComponent],
      providers: [
        ...fakes.providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: WORKING_CAPITAL_LOAN_TEST_TOOLS_API, useValue: tools },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WcLoanTestToolsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);

  function enterLoanId(value: string): void {
    const input = query('[data-testid="wc-test-tools-loan-id"]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('says these commands only work on a test instance', () => {
    // The screen is reachable only where a deployment opts in, but an operator who gets here
    // should not have to discover the 404 themselves.
    expect(query('[data-testid="wc-test-tools-notice"]')).not.toBeNull();
  });

  it('runs nothing without a loan to run it against', () => {
    expect(component.canRun()).toBe(false);

    component.onActivate();
    component.onRegenerateSchedule();
    component.onNextDelinquencyPeriod();

    expect(tools.activate).not.toHaveBeenCalled();
    expect(tools.regenerateAmortizationSchedule).not.toHaveBeenCalled();
    expect(tools.generateNextDelinquencyPeriod).not.toHaveBeenCalled();
  });

  it.each(['', '0', '-3', '2.5', 'abc'])('rejects %o as a loan id', (value) => {
    enterLoanId(value);

    expect(component.loanId()).toBeNull();
    expect(component.canRun()).toBe(false);
  });

  it('sends each command for the loan entered', () => {
    enterLoanId('11');
    expect(component.loanId()).toBe(11);

    component.onActivate();
    component.onRegenerateSchedule();
    component.onNextDelinquencyPeriod();

    expect(tools.activate).toHaveBeenCalledWith(11);
    expect(tools.regenerateAmortizationSchedule).toHaveBeenCalledWith(11);
    expect(tools.generateNextDelinquencyPeriod).toHaveBeenCalledWith(11);
  });

  it('reports that the platform accepted the command, not what it did', () => {
    enterLoanId('11');
    component.onActivate();

    // The screen has not re-read the loan, so it does not claim an outcome.
    expect(fakes.overlay.lastToast?.message).toContain('ACCEPTED');
    expect(component.isRunning()).toBe(false);
  });

  it('claims nothing when the platform refuses', () => {
    tools.activate.mockReturnValue(throwError(() => ({ status: 404 })));
    enterLoanId('11');
    component.onActivate();

    // A 404 is what these endpoints answer on a deployment without the test profile; the error
    // interceptor reports it, and this screen must not also say it worked.
    expect(fakes.overlay.toasts).toHaveLength(0);
    expect(component.isRunning()).toBe(false);
    expect(component.canRun()).toBe(true);
  });
});
