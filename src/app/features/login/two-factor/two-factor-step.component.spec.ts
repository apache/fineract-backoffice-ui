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
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TwoFactorStepComponent } from './two-factor-step.component';
import { AuthService } from '../../../core/services/auth.service';
import { TwoFactorAuthService } from '../../../core/services/two-factor.service';
import { provideFakeAdapters } from '../../../testing/adapters';

describe('TwoFactorStepComponent', () => {
  const CODE_FIELD = 'two-factor-code';
  const SUBMIT = 'two-factor-submit';
  const WRONG_CODE = 'WRONG';
  const SMS_METHOD = 'two-factor-method-sms';

  const EMAIL = { name: 'email', target: 'a***@example.org' };
  const SMS = { name: 'sms', target: '+44 *** 1234' };

  let fixture: ComponentFixture<TwoFactorStepComponent>;
  let host: HTMLElement;
  let twoFactorSpy: jasmine.SpyObj<TwoFactorAuthService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  const el = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${CSS.escape(id)}"]`);

  async function render(methods = [EMAIL]): Promise<void> {
    TestBed.resetTestingModule();
    twoFactorSpy = jasmine.createSpyObj('TwoFactorAuthService', [
      'deliveryMethods',
      'requestToken',
      'validate',
    ]);
    twoFactorSpy.deliveryMethods.and.returnValue(of(methods));
    twoFactorSpy.requestToken.and.returnValue(
      of({
        requestTime: 0,
        tokenLiveTimeInSec: 300,
        extendedAccessToken: false,
        deliveryMethod: methods[0] ?? EMAIL,
      }),
    );
    twoFactorSpy.validate.and.returnValue(of({ token: 'tfa-token-123', validFrom: 0, validTo: 1 }));

    authSpy = jasmine.createSpyObj('AuthService', ['completeTwoFactorAuthentication', 'logout']);

    await TestBed.configureTestingModule({
      imports: [TwoFactorStepComponent],
      providers: [
        { provide: TwoFactorAuthService, useValue: twoFactorSpy },
        { provide: AuthService, useValue: authSpy },
        ...provideFakeAdapters().providers,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TwoFactorStepComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  function enterCode(code: string): void {
    const input = el(CODE_FIELD) as HTMLInputElement;
    input.value = code;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  describe('choosing a delivery method', () => {
    it('skips the choice when the platform offers only one', async () => {
      // Making a user pick from a list of one is a step with a single possible answer.
      await render([EMAIL]);
      expect(twoFactorSpy.requestToken).toHaveBeenCalledWith('email');
      expect(el(CODE_FIELD)).toBeTruthy();
    });

    it('offers the choice when there are several', async () => {
      await render([EMAIL, SMS]);
      expect(twoFactorSpy.requestToken).not.toHaveBeenCalled();
      expect(el('two-factor-method-email')).toBeTruthy();
      expect(el(SMS_METHOD)).toBeTruthy();
    });

    it('requests the token for the method the user picked', async () => {
      await render([EMAIL, SMS]);
      el(SMS_METHOD)!.click();
      fixture.detectChanges();
      expect(twoFactorSpy.requestToken).toHaveBeenCalledWith('sms');
    });

    it('says so when the account has no delivery method configured', async () => {
      // There is no way to finish signing in; an empty list would leave the user guessing.
      await render([]);
      expect(host.textContent).toContain('login.twoFactor.noMethods');
      expect(el(CODE_FIELD)).toBeNull();
    });
  });

  describe('entering the code', () => {
    it('records the validated token and reports completion', async () => {
      await render();
      const completed = jasmine.createSpy('completed');
      fixture.componentInstance.completed.subscribe(completed);

      enterCode('NMKH4');
      el(SUBMIT)!.click();
      fixture.detectChanges();

      expect(twoFactorSpy.validate).toHaveBeenCalledWith('NMKH4');
      expect(authSpy.completeTwoFactorAuthentication).toHaveBeenCalledWith('tfa-token-123');
      expect(completed).toHaveBeenCalled();
    });

    it('trims what the user typed', async () => {
      await render();
      enterCode('  NMKH4 ');
      el(SUBMIT)!.click();
      expect(twoFactorSpy.validate).toHaveBeenCalledWith('NMKH4');
    });

    it("shows the platform's own reason when the code is refused", async () => {
      await render();
      twoFactorSpy.validate.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: {
                errors: [{ defaultUserMessage: 'The provided one time token is invalid' }],
              },
            }),
        ),
      );

      enterCode(WRONG_CODE);
      el(SUBMIT)!.click();
      fixture.detectChanges();

      expect(host.textContent).toContain('The provided one time token is invalid');
      expect(authSpy.completeTwoFactorAuthentication).not.toHaveBeenCalled();
    });

    it('keeps the user on the step and clears the field after a refusal', async () => {
      // `ngModel` writes back to the DOM on a microtask, so the assertion has to wait for it.
      await render();
      twoFactorSpy.validate.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: {} })),
      );

      enterCode(WRONG_CODE);
      el(SUBMIT)!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el(CODE_FIELD)).toBeTruthy();
      expect((el(CODE_FIELD) as HTMLInputElement).value).toBe('');
      expect(host.textContent).toContain('login.twoFactor.invalidCode');
    });

    it('sends another code on request', async () => {
      await render();
      twoFactorSpy.requestToken.calls.reset();

      el('two-factor-resend')!.click();
      fixture.detectChanges();

      expect(twoFactorSpy.requestToken).toHaveBeenCalledWith('email');
    });
  });

  describe('when the code cannot be sent', () => {
    it('returns to the choice rather than stranding the user on an empty form', async () => {
      twoFactorSpy = jasmine.createSpyObj('TwoFactorAuthService', [
        'deliveryMethods',
        'requestToken',
        'validate',
      ]);
      await render([EMAIL, SMS]);
      twoFactorSpy.requestToken.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );

      el('two-factor-method-email')!.click();
      fixture.detectChanges();

      expect(host.textContent).toContain('login.twoFactor.requestFailed');
      // Still on the choice, so another channel can be tried.
      expect(el(SMS_METHOD)).toBeTruthy();
    });
  });

  describe('accessibility and exit', () => {
    it('moves focus to the heading, because the form it replaced has gone', async () => {
      await render();
      expect(document.activeElement).toBe(host.querySelector('h2'));
    });

    it('signs the half-established session out when the user backs out', async () => {
      await render();
      const cancelled = jasmine.createSpy('cancelled');
      fixture.componentInstance.cancelled.subscribe(cancelled);

      el('two-factor-cancel')!.click();
      fixture.detectChanges();

      // Leaving the session half-established would keep a live Basic credential in storage.
      expect(authSpy.logout).toHaveBeenCalled();
      expect(cancelled).toHaveBeenCalled();
    });
  });
});
