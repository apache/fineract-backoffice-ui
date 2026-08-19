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

import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';

import { ConfigService } from '../services/config.service';

/**
 * Gates the screens that drive Fineract's `/v1/internal/**` endpoints.
 *
 * Those endpoints are served only when the backend runs with its `test` Spring profile, which
 * upstream states must not be enabled in production — on a normal deployment every one of them
 * answers 404. Hiding the navigation entry is not enough on its own, because the routes stay
 * reachable by URL, so the same flag is enforced here as well.
 *
 * `CanMatchFn` rather than `CanActivateFn`: a non-matching route falls through to the wildcard
 * route and the user lands on the dashboard, which is the same thing that happens for any address
 * this deployment does not serve. That is the intent — with the flag off, these paths simply are
 * not part of the application.
 */
export const developerToolsGuard: CanMatchFn = () => inject(ConfigService).developerToolsEnabled();
