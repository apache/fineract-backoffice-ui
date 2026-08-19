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

import { authGuard } from '../../core/guards/auth.guard';
import { permissionGuard } from '../../core/guards/permission.guard';
import { Routes } from '@angular/router';

export const SPM_ROUTES: Routes = [
  {
    path: 'surveys',
    loadComponent: () =>
      import('./surveys/spm-surveys-list.component').then((m) => m.SpmSurveysListComponent),
  },
  {
    path: 'surveys/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'REGISTER_SURVEY' },
    loadComponent: () =>
      import('./surveys/spm-surveys-form.component').then((m) => m.SpmSurveysFormComponent),
  },
  {
    path: 'surveys/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'REGISTER_SURVEY' },
    loadComponent: () =>
      import('./surveys/spm-surveys-form.component').then((m) => m.SpmSurveysFormComponent),
  },
  {
    path: 'surveys/:surveyId/scorecards',
    loadComponent: () =>
      import('./scorecards/scorecards.component').then((m) => m.ScorecardsComponent),
  },
  {
    path: 'poverty-line',
    loadComponent: () =>
      import('./poverty-line/poverty-line.component').then((m) => m.PovertyLineComponent),
  },
  {
    path: 'likelihood',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_LIKELIHOOD' },
    loadComponent: () =>
      import('./likelihood/likelihood.component').then((m) => m.LikelihoodComponent),
  },
  {
    path: 'survey-responses',
    loadComponent: () =>
      import('./survey-responses/survey-responses.component').then(
        (m) => m.SurveyResponsesComponent,
      ),
  },
];
