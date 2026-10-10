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

import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ScoreCardService, Scorecard } from '../../../api';

/**
 * Read-only view of the scorecard entries collected for a single SPM survey.
 * Nested client / question objects are flattened into display rows.
 */
interface ScorecardRow {
  client: string;
  question: string;
  value: number | undefined;
  createdOn: string | undefined;
}

@Component({
  selector: 'app-scorecards',
  standalone: true,
  imports: [DataTableComponent],
  template: `
    <app-data-table
      title="SCORECARDS.TITLE"
      helpTextKey="HELP.SCORECARDS_DESC"
      [columns]="columns"
      [data]="rows()"
      [totalRecords]="rows().length"
      [localLogic]="true"
    ></app-data-table>
  `,
})
export class ScorecardsComponent implements OnInit {
  private readonly scoreCardService = inject(ScoreCardService);
  private readonly route = inject(ActivatedRoute);

  readonly columns: ColumnDef[] = [
    { key: 'client', label: 'SCORECARDS.CLIENT', sortable: true },
    { key: 'question', label: 'SCORECARDS.QUESTION', sortable: true },
    { key: 'value', label: 'SCORECARDS.VALUE', sortable: true },
    { key: 'createdOn', label: 'SCORECARDS.CREATED_ON', sortable: true },
  ];

  surveyId: number | null = null;
  readonly rows = signal<ScorecardRow[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('surveyId');
    if (id) {
      this.surveyId = +id;
      this.load();
    }
  }

  load(): void {
    if (!this.surveyId) return;
    this.scoreCardService.getSurveysScorecardsSurveyId(this.surveyId).subscribe({
      next: (data: Scorecard[]) => {
        this.rows.set(
          (data || []).map((sc) => ({
            client: sc.client?.displayName ?? '',
            question: sc.question?.text ?? sc.question?.key ?? '',
            value: sc.value,
            createdOn: sc.createdOn,
          })),
        );
      },
      error: (err: unknown) => {
        console.error('Failed to load scorecards', err);
      },
    });
  }
}
