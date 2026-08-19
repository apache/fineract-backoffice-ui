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

import { Injectable, inject, NgZone, OnDestroy, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';
import { NavigationEnd, Router } from '@angular/router';
import { filter, fromEvent, merge, Subscription, throttleTime } from 'rxjs';
import { ModalHandle } from '../adapters';
import { DialogService } from './dialog.service';
import { InactivityDialogComponent } from '../../layout/inactivity-dialog.component';

/**
 * Service responsible for monitoring user activity and managing session timeouts.
 *
 * When a user is authenticated, it listens for global activity events (mouse, keyboard, etc.)
 * and maintains an idle timer. If the user is inactive for a set period, it displays a
 * warning dialog and eventually logs the user out.
 */
@Injectable({
  providedIn: 'root',
})
export class IdleService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly dialogService = inject(DialogService);

  private idleSubscription?: Subscription;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private dialogRef: ModalHandle<boolean> | null = null;
  /**
   * True from the instant the warning is requested, not from when it finishes presenting.
   *
   * `dialogRef` alone cannot guard the activity-event handler below: it is only assigned
   * once `dialogService.present()`'s promise resolves, which leaves a window — a throttled
   * activity event landing in the moment between the timer firing and the modal actually
   * being on screen — where that handler saw `dialogRef` still unset and called
   * `resetTimer()`. That clears the hard logout timeout `showInactivityWarning()` had just
   * armed and reschedules a fresh 13-minute wait, leaving the now-visible warning dialog
   * with nothing left to time it out — indefinitely, if the user never answers it.
   */
  private presentingWarning = false;

  // Configuration
  /** Total time of inactivity allowed before forced logout (15 minutes) */
  private readonly IDLE_TIMEOUT = 15 * 60 * 1000;
  /** Time before final logout when the warning dialog should be shown (2 minutes) */
  private readonly WARNING_TIME = 2 * 60 * 1000;

  constructor() {
    // Automatically start/stop monitoring based on authentication state
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    });

    // Belt-and-suspenders: whatever ends up sending the user to the login page — the
    // logout timer below, a 401 elsewhere in the app — must never leave this warning on
    // screen once they have actually landed there. `stopMonitoring()` already runs when
    // `isAuthenticated` flips to `false`, but this does not depend on that signal update,
    // the dismiss it triggers, or this service's own timer logic ever having run at all.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if ((event as NavigationEnd).urlAfterRedirects.startsWith('/login')) {
          this.closeDialog();
        }
      });
  }

  /**
   * Initializes activity monitoring using global window events.
   *
   * Events are throttled and monitoring runs outside the Angular zone
   * to avoid unnecessary change detection cycles.
   */
  private startMonitoring(): void {
    this.stopMonitoring();

    this.ngZone.runOutsideAngular(() => {
      const activityEvents$ = merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'click'),
        fromEvent(window, 'scroll'),
        fromEvent(window, 'touchstart'),
      ).pipe(throttleTime(5000));

      this.idleSubscription = activityEvents$.subscribe(() => {
        // Only reset the timer if the warning dialog is not currently open (or being opened).
        if (!this.presentingWarning) {
          this.resetTimer();
        }
      });
    });

    this.resetTimer();
  }

  /**
   * Stops monitoring and performs cleanup of subscriptions and timers.
   */
  private stopMonitoring(): void {
    this.clearTimers();
    this.idleSubscription?.unsubscribe();
    this.closeDialog();
  }

  /**
   * Clears the current inactivity timeout timer.
   */
  private clearTimers(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Resets the inactivity timer to wait until the next warning threshold.
   */
  private resetTimer(): void {
    this.clearTimers();

    const timeToWarning = this.IDLE_TIMEOUT - this.WARNING_TIME;

    this.timeoutId = setTimeout(() => {
      this.showInactivityWarning();
    }, timeToWarning);
  }

  /**
   * Opens the inactivity warning dialog and sets a final logout timer.
   */
  private showInactivityWarning(): void {
    this.ngZone.run(() => {
      if (this.presentingWarning) return;
      this.presentingWarning = true;

      // The warning must not be dismissable by backdrop or escape — ignoring it has to
      // fall through to the logout timer below, not silently cancel the countdown.
      this.dialogService
        .present<boolean>(InactivityDialogComponent, undefined, {
          dismissible: false,
          cssClass: 'inactivity-dialog',
        })
        .then((handle) => {
          this.dialogRef = handle;

          return handle.result.then((shouldExtend) => {
            this.dialogRef = null;
            this.presentingWarning = false;
            if (shouldExtend) {
              this.resetTimer();
            } else {
              this.logoutDueToInactivity();
            }
          });
        });

      // Also set a hard logout timeout if the user fails to respond to the dialog
      this.timeoutId = setTimeout(() => {
        this.logoutDueToInactivity();
      }, this.WARNING_TIME);
    });
  }

  /**
   * Forces a user logout and redirects to the login page due to inactivity.
   */
  private logoutDueToInactivity(): void {
    this.ngZone.run(() => {
      if (this.authService.isAuthenticated()) {
        console.warn('Session expired due to inactivity.');
        this.closeDialog();
        this.authService.logout();
        this.router.navigate(['/login'], { queryParams: { reason: 'inactivity' } });
      }
    });
  }

  /**
   * Safely closes the warning dialog if it is open.
   */
  private closeDialog(): void {
    this.presentingWarning = false;
    if (this.dialogRef) {
      void this.dialogRef.dismiss();
      this.dialogRef = null;
    }
  }

  /**
   * Angular lifecycle hook to ensure cleanup when the service is destroyed.
   */
  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
