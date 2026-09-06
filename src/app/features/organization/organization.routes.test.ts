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

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ORGANIZATION_ROUTES } from './organization.routes';

@Component({
  standalone: true,
  template: '',
})
class RouteStub {}

describe('ORGANIZATION_ROUTES', () => {
  beforeEach(() => {
    const routes = ORGANIZATION_ROUTES.map((route) =>
      route.redirectTo ? route : { path: route.path, component: RouteStub },
    );

    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'organization', children: routes }])],
    });
  });

  it('redirects the feature root to offices', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/organization');

    expect(TestBed.inject(Router).url).toBe('/organization/offices');
  });
});
