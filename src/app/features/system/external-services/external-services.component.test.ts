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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExternalServicesComponent } from './external-services.component';
import { ExternalServicesService } from '../../../api';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ExternalServicesComponent', () => {
  let component: ExternalServicesComponent;
  let fixture: ComponentFixture<ExternalServicesComponent>;
  let serviceSpy: SpyObj<ExternalServicesService>;
  let notifications: SpyObj<NotificationService>;
  let auth: SpyObj<AuthService>;

  type GetResult = ReturnType<ExternalServicesService['getExternalserviceServicename']>;
  type PutResult = ReturnType<ExternalServicesService['putExternalserviceServicename']>;

  function selectService(name: string, response: unknown): void {
    serviceSpy.getExternalserviceServicename.mockReturnValue(response as GetResult);
    component.selectedService = name;
    component.load();
    fixture.detectChanges();
  }

  function saveButton(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="external-services-save"]');
  }

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getExternalserviceServicename', 'putExternalserviceServicename']);
    serviceSpy.getExternalserviceServicename.mockReturnValue(
      of([
        { name: 's3_access_key', value: 'abc' },
        { name: 's3_bucket_name', value: 'bucket' },
      ]) as unknown as ReturnType<ExternalServicesService['getExternalserviceServicename']>,
    );

    notifications = createSpyObj(['success', 'error', 'show']);
    auth = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: [] }),
    });
    auth.hasPermission.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [ExternalServicesComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ExternalServicesService, useValue: serviceSpy },
        { provide: NotificationService, useValue: notifications },
        { provide: AuthService, useValue: auth },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExternalServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load properties for the default service on init', () => {
    expect(component.selectedService).toBe('S3');
    expect(component.properties()).toHaveLength(2);
  });

  it('should put a name/value map on save', () => {
    serviceSpy.putExternalserviceServicename.mockReturnValue(
      of({}) as unknown as ReturnType<ExternalServicesService['putExternalserviceServicename']>,
    );
    component.properties()[0].value = 'changed';
    component.onSave();
    expect(serviceSpy.putExternalserviceServicename).toHaveBeenCalledWith('S3', {
      s3_access_key: 'changed',
    } as never);
  });

  it('sends nothing when no field changed', () => {
    component.onSave();
    expect(serviceSpy.putExternalserviceServicename).not.toHaveBeenCalled();
  });

  describe('SMS gateway', () => {
    it('lists all four gateway fields even when none is stored', () => {
      selectService('SMS', of([]));

      expect(component.properties().map((p) => p.name)).toEqual([
        'host_name',
        'port_number',
        'end_point',
        'tenant_app_key',
      ]);
      expect(fixture.nativeElement.querySelector('[data-testid="sms-help"]')).not.toBeNull();
    });

    it('never loads the stored app key into the form, and reports it as set', () => {
      selectService(
        'SMS',
        of([
          { name: 'host_name', value: 'sms.internal' },
          { name: 'tenant_app_key', value: 'stored-secret' },
        ]),
      );

      const key = component.properties().find((p) => p.name === 'tenant_app_key');
      expect(key).toEqual({ name: 'tenant_app_key', value: '', secret: true, isSet: true });
      expect(JSON.stringify(component.properties())).not.toContain('stored-secret');
      const input = fixture.nativeElement.querySelector('[data-testid="secret-tenant_app_key"]');
      expect(input.getAttribute('type')).toBe('password');
    });

    it('sends only the edited fields, leaving an unchanged app key out', () => {
      selectService('SMS', of([{ name: 'tenant_app_key', value: 'stored-secret' }]));
      serviceSpy.putExternalserviceServicename.mockReturnValue(of({}) as unknown as PutResult);
      component.properties().find((p) => p.name === 'host_name')!.value = 'sms.internal';
      // Ionic's numeric input hands the model a number, not a string.
      component.properties().find((p) => p.name === 'port_number')!.value = 9191;

      component.onSave();

      expect(serviceSpy.putExternalserviceServicename).toHaveBeenCalledWith('SMS', {
        host_name: 'sms.internal',
        port_number: '9191',
      } as never);
      expect(notifications.success).toHaveBeenCalledWith('EXTERNAL_SERVICES.SAVED');
    });

    it('treats a port typed and then cleared as unchanged', () => {
      selectService('SMS', of([]));
      component.properties().find((p) => p.name === 'port_number')!.value = null;

      component.onSave();

      expect(serviceSpy.putExternalserviceServicename).not.toHaveBeenCalled();
      expect(notifications.show).toHaveBeenCalledWith('EXTERNAL_SERVICES.NO_CHANGES');
    });

    it('sends a newly typed app key', () => {
      selectService('SMS', of([]));
      serviceSpy.putExternalserviceServicename.mockReturnValue(of({}) as unknown as PutResult);
      component.properties().find((p) => p.name === 'tenant_app_key')!.value = 'new-key';

      component.onSave();

      expect(serviceSpy.putExternalserviceServicename).toHaveBeenCalledWith(
        'SMS',
        expect.objectContaining({ tenant_app_key: 'new-key' }) as never,
      );
    });

    it('clears the saving state when the save fails', () => {
      selectService('SMS', of([]));
      component.properties().find((p) => p.name === 'tenant_app_key')!.value = 'new-key';
      serviceSpy.putExternalserviceServicename.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400 })) as unknown as PutResult,
      );

      component.onSave();

      expect(component.isSaving()).toBe(false);
    });
  });

  it('refreshes in place after a save, without blanking the form', () => {
    serviceSpy.putExternalserviceServicename.mockReturnValue(of({}) as unknown as PutResult);
    const refresh = new Subject<unknown>();
    serviceSpy.getExternalserviceServicename.mockReturnValue(refresh as unknown as GetResult);
    component.properties()[0].value = 'changed';

    component.onSave();

    expect(component.properties()).toHaveLength(2);
    refresh.next([{ name: 's3_access_key', value: 'changed' }]);
    expect(component.properties()).toEqual([
      { name: 's3_access_key', value: 'changed', original: 'changed' },
    ]);
  });

  it('clears the form when the refresh after a save fails', () => {
    serviceSpy.putExternalserviceServicename.mockReturnValue(of({}) as unknown as PutResult);
    serviceSpy.getExternalserviceServicename.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })) as unknown as GetResult,
    );
    component.properties()[0].value = 'changed';

    component.onSave();

    expect(component.properties()).toEqual([]);
    expect(component.loadError()).toBe('failed');
  });

  it('shows no access, not an empty form, when the platform refuses the read', () => {
    selectService(
      'SMS',
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    expect(component.loadError()).toBe('forbidden');
    expect(component.properties()).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="external-services-load-error"]'),
    ).not.toBeNull();
  });

  it('offers a retry when the read fails for another reason', () => {
    selectService(
      'SMTP',
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    expect(component.loadError()).toBe('failed');

    selectService('SMTP', of([{ name: 'host', value: 'smtp.internal' }]));
    expect(component.loadError()).toBeNull();
    expect(component.properties()).toHaveLength(1);
  });

  it('keeps Save disabled without UPDATE_EXTERNALSERVICES after the data arrives', async () => {
    auth.hasPermission.mockReturnValue(false);
    const response = new Subject<unknown>();
    serviceSpy.getExternalserviceServicename.mockReturnValue(response as unknown as GetResult);
    fixture = TestBed.createComponent(ExternalServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    response.next([{ name: 's3_bucket_name', value: 'bucket' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.properties()).toHaveLength(1);
    expect((saveButton() as HTMLElement & { disabled: boolean }).disabled).toBe(true);
    component.properties()[0].value = 'changed';
    component.onSave();
    expect(serviceSpy.putExternalserviceServicename).not.toHaveBeenCalled();
  });

  it('ignores a stale response once a newer load has started', () => {
    const stale = new Subject<unknown>();
    selectService('SMS', stale);
    selectService('SMS', of([{ name: 'host_name', value: 'fresh' }]));

    stale.next([{ name: 'host_name', value: 'stale' }]);

    expect(component.properties()[0].value).toBe('fresh');
  });
});
