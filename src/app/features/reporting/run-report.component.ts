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

import { CdkTableModule } from '@angular/cdk/table';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import { DOWNLOAD } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import { toIsoDate } from '../../core/utils/date-formatter';
import { HelpIconComponent } from '../../shared';
import { BarChartComponent } from '../../shared/components/charts/bar-chart.component';
import {
  ChartData,
  DonutChartComponent,
} from '../../shared/components/charts/donut-chart.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { PageEvent } from '../../shared/models/table.model';
import {
  ALL_OPTION,
  ReportExecutionService,
  ReportParameter,
  ReportParameterValues,
  ReportSelectOption,
  offersAllOption,
} from './report-execution.service';

const SUPPORTED_DISPLAY_TYPES = new Set(['select', 'date', 'text', 'none']);

/**
 * Report types are declared by the report definition and, in this platform, are exactly
 * `Table`, `Chart` and `SMS` — posting anything else answers
 * `validation.msg.report.reportType.is.not.one.of.expected.enumerations`. Everything that is not
 * a chart renders as a table, which is what `SMS` and `Email` definitions want anyway.
 */
const CHART_REPORT_TYPE = 'chart';

/** The platform's two chart sub-types are `Bar` and `Pie`; `Bar` is the default. */
const PIE_SUB_TYPE = 'pie';

/** `columnDisplayType` values that can be plotted. Anything else can only be a category. */
const NUMERIC_DISPLAY_TYPES = new Set(['INTEGER', 'DECIMAL', 'REAL', 'DOUBLE', 'FLOAT', 'NUMBER']);

/** Distinct hues for a report grouped by branch or product; beyond these they repeat. */
const CHART_PALETTE = [
  '#3880ff',
  '#2dd36f',
  '#ffc409',
  '#eb445a',
  '#6030ff',
  '#0cd1e8',
  '#f4a261',
  '#8e44ad',
];

type OptionStatus = 'idle' | 'loading' | 'loaded' | 'failed';

/** What a report parameter can hold: the platform sends every value back as a query string. */
type ParameterValue = string | number | undefined;

interface DependentOptionState {
  readonly status: OptionStatus;
  readonly options: readonly ReportSelectOption[];
}

const IDLE_STATE: DependentOptionState = { status: 'idle', options: [] };

/**
 * What one parameter control needs to render.
 *
 * Built as a computed rather than by template methods: a method returning a fresh array or object
 * on every change-detection pass gives Angular a new identity each time, which is an NG0100 under
 * the exhaustive check-no-changes configured for dev builds.
 */
interface ReportParameterView {
  readonly parameter: ReportParameter;
  readonly options: readonly ReportSelectOption[];
  readonly value: ParameterValue;
  readonly stringValue: string | undefined;
  readonly disabled: boolean;
  readonly waitingForParent: boolean;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly parentLabel: string;
  readonly controlId: string;
  readonly datePickerId: string;
  readonly testId: string;
}

@Component({
  selector: 'app-run-report',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    CdkTableModule,
    PaginatorComponent,
    HelpIconComponent,
    BarChartComponent,
    DonutChartComponent,
    IonIcon,
    IonButton,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonInput,
    IonModal,
    IonNote,
    IonSpinner,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'REPORTS.RUN_TITLE' | translate }}: {{ reportName() }}
            <app-help-icon [helpTextKey]="'HELP.REPORTS_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (isParametersLoading()) {
            <div class="parameter-status" data-testid="report-parameters-loading">
              <ion-spinner name="crescent"></ion-spinner>
              <span>{{ 'REPORTS.PARAMETERS_LOADING' | translate }}</span>
            </div>
          } @else if (parameterLoadFailed()) {
            <ion-note color="danger" data-testid="report-parameters-error">
              {{ 'REPORTS.PARAMETERS_LOAD_FAILED' | translate }}
            </ion-note>
          } @else if (unsupportedParameters().length > 0) {
            <ion-note color="danger" data-testid="report-parameters-unsupported">
              {{ 'REPORTS.PARAMETERS_UNSUPPORTED' | translate }}:
              {{ unsupportedParameterNames() }}
            </ion-note>
          }

          <div class="report-parameters form-grid">
            @for (view of parameterViews(); track view.parameter.queryParameter) {
              @switch (view.parameter.displayType) {
                @case ('select') {
                  <div class="parameter-field">
                    <ion-item fill="outline" [attr.data-testid]="view.testId" [id]="view.controlId">
                      <ion-label position="stacked">{{ view.parameter.label }}</ion-label>
                      <ion-select
                        [id]="view.controlId + '-select'"
                        [attr.data-testid]="view.testId + '-select'"
                        [attr.aria-label]="view.parameter.label"
                        interface="popover"
                        [disabled]="view.disabled"
                        [value]="view.value"
                        (ionChange)="onParameterChange(view.parameter, $event)"
                      >
                        @for (option of view.options; track option.id) {
                          <ion-select-option [value]="option.id">
                            {{ option.isAll ? ('COMMON.ALL' | translate) : option.name }}
                          </ion-select-option>
                        }
                      </ion-select>
                    </ion-item>

                    @if (view.waitingForParent) {
                      <ion-note class="field-note" [attr.data-testid]="view.testId + '-waiting'">
                        {{
                          'REPORTS.PARAMETER_SELECT_PARENT_FIRST'
                            | translate: { parameter: view.parentLabel }
                        }}
                      </ion-note>
                    } @else if (view.loading) {
                      <ion-note class="field-note" [attr.data-testid]="view.testId + '-loading'">
                        {{ 'REPORTS.PARAMETER_OPTIONS_LOADING' | translate }}
                      </ion-note>
                    } @else if (view.failed) {
                      <ion-note
                        class="field-note"
                        color="danger"
                        [attr.data-testid]="view.testId + '-error'"
                      >
                        {{ 'REPORTS.PARAMETER_OPTIONS_FAILED' | translate }}
                      </ion-note>
                    }
                  </div>
                }
                @case ('date') {
                  <div class="parameter-field">
                    <ion-item fill="outline" [attr.data-testid]="view.testId" [id]="view.controlId">
                      <ion-label position="stacked">{{ view.parameter.label }}</ion-label>
                      <ion-datetime-button
                        [id]="view.controlId + '-button'"
                        [attr.data-testid]="view.testId + '-button'"
                        [datetime]="view.datePickerId"
                      ></ion-datetime-button>
                      <ion-modal [keepContentsMounted]="true">
                        <ng-template>
                          <ion-datetime
                            presentation="date"
                            [id]="view.datePickerId"
                            [attr.data-testid]="view.datePickerId"
                            [value]="view.stringValue"
                            (ionChange)="onParameterChange(view.parameter, $event)"
                          ></ion-datetime>
                        </ng-template>
                      </ion-modal>
                    </ion-item>
                  </div>
                }
                @case ('text') {
                  <div class="parameter-field">
                    <ion-item fill="outline" [attr.data-testid]="view.testId" [id]="view.controlId">
                      <ion-label position="stacked">{{ view.parameter.label }}</ion-label>
                      <ion-input
                        [id]="view.controlId + '-input'"
                        [attr.data-testid]="view.testId + '-input'"
                        type="text"
                        [attr.aria-label]="view.parameter.label"
                        [value]="view.stringValue"
                        (ionInput)="onParameterChange(view.parameter, $event)"
                      ></ion-input>
                    </ion-item>
                  </div>
                }
              }
            }
          </div>

          @if (parametersLoaded() && !parameterLoadFailed() && !canRun()) {
            <ion-note data-testid="report-parameters-incomplete">
              {{ 'REPORTS.PARAMETERS_INCOMPLETE' | translate }}
            </ion-note>
          }

          <div class="form-actions">
            <ion-button
              id="cancel-report"
              data-testid="cancel-report"
              fill="clear"
              (click)="onCancel()"
              >{{ 'COMMON.CANCEL' | translate }}</ion-button
            >
            <ion-button
              id="download-report-csv"
              data-testid="download-report-csv"
              color="secondary"
              (click)="onDownloadCSV()"
              [disabled]="!canRun() || isLoading()"
            >
              <ion-icon name="download-outline"></ion-icon>
              {{ 'REPORTS.DOWNLOAD_CSV' | translate }}
            </ion-button>
            <ion-button
              id="run-report"
              data-testid="run-report"
              color="primary"
              (click)="onRun()"
              [disabled]="!canRun() || isLoading()"
            >
              {{ isLoading() ? ('COMMON.LOADING' | translate) : ('REPORTS.RUN' | translate) }}
            </ion-button>
          </div>

          @if (reportData()) {
            <div class="report-results mt-4">
              <hr class="divider" />
              <div class="results-header">
                <h3 class="mt-2">{{ 'REPORTS.RESULTS' | translate }}</h3>
                <ion-button
                  id="download-report-results-csv"
                  data-testid="download-report-results-csv"
                  color="primary"
                  (click)="downloadCSV()"
                >
                  <ion-icon name="download-outline"></ion-icon>
                  {{ 'REPORTS.DOWNLOAD_RESULTS_CSV' | translate }}
                </ion-button>
              </div>
              @if (chartUnavailable()) {
                <ion-note color="warning" data-testid="report-chart-unavailable">
                  {{ 'REPORTS.CHART_UNAVAILABLE' | translate }}
                </ion-note>
              }

              @if (showsChart()) {
                <div class="chart-wrapper" data-testid="report-chart">
                  @if (isPieChart()) {
                    <app-donut-chart
                      data-testid="report-chart-pie"
                      [data]="chartSeries()"
                    ></app-donut-chart>
                  } @else {
                    <app-bar-chart
                      data-testid="report-chart-bar"
                      [data]="chartSeries()"
                    ></app-bar-chart>
                  }
                </div>
              } @else {
                <div class="table-container" data-testid="report-table">
                  <table cdk-table [dataSource]="pagedRows()">
                    @for (col of displayedColumns(); track col; let i = $index) {
                      <ng-container [cdkColumnDef]="col">
                        <th cdk-header-cell *cdkHeaderCellDef>{{ col }}</th>
                        <td cdk-cell *cdkCellDef="let row">{{ getReportCellValue(row, i) }}</td>
                      </ng-container>
                    }
                    <tr cdk-header-row *cdkHeaderRowDef="displayedColumns()"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: displayedColumns()"></tr>
                  </table>
                  <app-paginator
                    [length]="dataRows().length"
                    [pageSize]="pageSize()"
                    [pageIndex]="pageIndex()"
                    [pageSizeOptions]="[10, 20, 50, 100]"
                    (page)="onPage($event)"
                  ></app-paginator>
                </div>
              }
            </div>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }
      .parameter-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      .parameter-field {
        display: flex;
        flex-direction: column;
      }
      .field-note {
        margin: 4px 0 0;
        font-size: 12px;
      }
      .chart-wrapper {
        display: flex;
        justify-content: center;
        margin-top: 16px;
      }
      ion-note {
        display: block;
        margin: 8px 0 16px;
      }
      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        margin-bottom: 8px;
      }
      .table-container {
        overflow-x: auto;
        margin-top: 16px;
      }
      .mt-4 {
        margin-top: 2rem;
      }
      .mt-2 {
        margin-top: 1rem;
      }
      @media (max-width: 900px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RunReportComponent implements OnInit {
  private readonly reportExecution = inject(ReportExecutionService);
  private readonly download = inject(DOWNLOAD);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly reportName = signal('');
  /** Declared by the report definition and carried on the query string by the list screen. */
  readonly reportType = signal('');
  readonly reportSubType = signal('');
  readonly isLoading = signal(false);
  readonly isParametersLoading = signal(false);
  readonly parametersLoaded = signal(false);
  readonly parameterLoadFailed = signal(false);
  readonly parameters = signal<ReportParameter[]>([]);
  readonly parameterValues = signal<Record<string, string | number>>({});
  /** Options for parameters whose lookup is scoped by a parent, keyed by parameter name. */
  readonly dependentOptions = signal<Record<string, DependentOptionState>>({});

  readonly unsupportedParameters = computed(() =>
    this.parameters().filter((parameter) => !SUPPORTED_DISPLAY_TYPES.has(parameter.displayType)),
  );
  readonly unsupportedParameterNames = computed(() =>
    this.unsupportedParameters()
      .map((parameter) => `${parameter.label} (${parameter.displayType})`)
      .join(', '),
  );
  readonly canRun = computed(
    () =>
      this.parametersLoaded() &&
      !this.parameterLoadFailed() &&
      this.unsupportedParameters().length === 0 &&
      this.parameters().every((parameter) =>
        this.hasValue(this.parameterValues()[parameter.queryParameter]),
      ),
  );

  /**
   * The parameter controls, resolved against the current values and dependent lookups.
   *
   * A dependent parameter is disabled until its parent has a value: rendering it as a flat list of
   * every loan officer in the institution both is unusable across a branch network and lets an
   * officer be chosen who does not work in the selected office, which returns an empty report with
   * nothing to explain it.
   */
  readonly parameterViews = computed<ReportParameterView[]>(() => {
    const parameters = this.parameters();
    const values = this.parameterValues();
    const dependents = this.dependentOptions();
    const byName = new Map(parameters.map((parameter) => [parameter.name, parameter]));

    return parameters.map((parameter, index) => {
      const parent = parameter.parentParameterName
        ? byName.get(parameter.parentParameterName)
        : undefined;
      const state = dependents[parameter.name] ?? IDLE_STATE;
      const waitingForParent =
        parent !== undefined && !this.hasValue(values[parent.queryParameter]);
      const value = values[parameter.queryParameter];
      const controlId = `report-parameter-${this.safeIdentifier(parameter.variable)}-${index}`;

      return {
        parameter,
        options: parent ? state.options : parameter.options,
        value,
        stringValue: value === undefined ? undefined : String(value),
        disabled: waitingForParent || state.status === 'loading',
        waitingForParent,
        loading: state.status === 'loading',
        failed: parent ? state.status === 'failed' : parameter.optionsFailed,
        parentLabel: parent?.label ?? '',
        controlId,
        datePickerId: `${controlId}-picker`,
        testId: `report-parameter-${this.safeIdentifier(parameter.variable)}`,
      };
    });
  });

  readonly reportData = signal<Record<string, unknown> | null>(null);
  readonly displayedColumns = signal<string[]>([]);
  readonly columnHeaders = signal<Record<string, unknown>[]>([]);
  readonly dataRows = signal<Record<string, unknown>[]>([]);
  /** Report results are fetched whole, so paging happens client-side. */
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly rows = signal<Record<string, unknown>[]>([]);

  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly isChartReport = computed(() => this.reportType().toLowerCase() === CHART_REPORT_TYPE);
  readonly isPieChart = computed(() => this.reportSubType().toLowerCase() === PIE_SUB_TYPE);

  /**
   * The plottable series behind a chart report.
   *
   * A chart report returns the *same* generic resultset as a table report — the platform does no
   * chart-specific work at all, so the shape has to be inferred here: the first numeric column is
   * the value and the first column that is not it is the category.
   */
  readonly chartSeries = computed<ChartData[]>(() => {
    if (!this.isChartReport()) return [];

    const headers = this.columnHeaders();
    const rows = this.dataRows();
    if (headers.length === 0 || rows.length === 0) return [];

    const valueIndex = headers.findIndex((header) =>
      NUMERIC_DISPLAY_TYPES.has(String(header['columnDisplayType']).toUpperCase()),
    );
    if (valueIndex === -1) return [];
    const labelIndex = headers.findIndex((_, index) => index !== valueIndex);

    return rows
      .map((row, index) => ({
        label: labelIndex === -1 ? String(index + 1) : this.getReportCellValue(row, labelIndex),
        value: Number(this.getReportCellValue(row, valueIndex)),
        color: CHART_PALETTE[index % CHART_PALETTE.length],
      }))
      .filter((point) => Number.isFinite(point.value));
  });

  readonly showsChart = computed(() => this.isChartReport() && this.chartSeries().length > 0);

  /**
   * A report can be *declared* a chart while returning nothing plottable — a definition whose SQL
   * selects only text columns, say. Falling back to the table is better than an empty panel, but
   * it has to say why it did.
   */
  readonly chartUnavailable = computed(
    () => this.isChartReport() && this.reportData() !== null && this.chartSeries().length === 0,
  );

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const reportName = params.get('reportName') || '';
      this.reportName.set(reportName);
      this.loadParameters(reportName);
    });
    this.route.queryParamMap.subscribe((params) => {
      this.reportType.set(params.get('type') || '');
      this.reportSubType.set(params.get('subType') || '');
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onParameterChange(parameter: ReportParameter, event: Event): void {
    const detailValue = (event as CustomEvent<{ value?: string | number | null }>).detail?.value;
    const targetValue = (event.target as HTMLInputElement | null)?.value;
    const value = detailValue ?? targetValue;
    if (value !== undefined && value !== null) {
      this.setParameterValue(parameter, value);
    }
  }

  setParameterValue(parameter: ReportParameter, value: string | number): void {
    this.parameterValues.update((current) => ({
      ...current,
      [parameter.queryParameter]: value,
    }));
    this.refreshDependents(parameter, value);
  }

  parameterValue(parameter: ReportParameter): string | number | undefined {
    return this.parameterValues()[parameter.queryParameter];
  }

  /**
   * Reloads everything downstream of a parameter that has just changed.
   *
   * The child is cleared before it is refetched, not merely refetched: leaving the previously
   * chosen loan officer selected after the office changes is how a report ends up filtered to an
   * officer who does not work there, which returns no rows and says nothing about why.
   */
  private refreshDependents(parameter: ReportParameter, parentValue: string | number): void {
    for (const child of this.childrenOf(parameter.name)) {
      this.clearParameter(child, new Set([parameter.name]));
      this.loadDependentOptions(child, parameter.queryParameter, parentValue);
    }
  }

  private childrenOf(name: string): ReportParameter[] {
    return this.parameters().filter((parameter) => parameter.parentParameterName === name);
  }

  /**
   * Clears a parameter and everything downstream of it.
   *
   * `seen` guards against a report definition that names a parent cycle: the parameter list is
   * tenant data, and a cycle in it would otherwise hang the browser rather than break the report.
   */
  private clearParameter(parameter: ReportParameter, seen: Set<string>): void {
    if (seen.has(parameter.name)) return;
    seen.add(parameter.name);

    this.parameterValues.update((current) => {
      const next = { ...current };
      delete next[parameter.queryParameter];
      return next;
    });
    this.dependentOptions.update((current) => ({ ...current, [parameter.name]: IDLE_STATE }));

    for (const child of this.childrenOf(parameter.name)) {
      this.clearParameter(child, seen);
    }
  }

  private loadDependentOptions(
    parameter: ReportParameter,
    parentQueryParameter: string,
    parentValue: string | number,
  ): void {
    this.setDependentState(parameter, 'loading', []);

    this.reportExecution
      .getDependentOptions(parameter, parentQueryParameter, parentValue)
      .subscribe({
        next: (options) => this.setDependentState(parameter, 'loaded', options),
        // A lookup can fail for reasons the user cannot act on — the stock loan-officer lookup
        // compares a bigint column against a bound string and fails outright on PostgreSQL. "All"
        // is declared by the parameter rather than discovered by the lookup, so offering it keeps
        // the report runnable unfiltered instead of blocking it entirely.
        error: () =>
          this.setDependentState(
            parameter,
            'failed',
            offersAllOption(parameter) ? [ALL_OPTION] : [],
          ),
      });
  }

  private setDependentState(
    parameter: ReportParameter,
    status: OptionStatus,
    options: readonly ReportSelectOption[],
  ): void {
    this.dependentOptions.update((current) => ({
      ...current,
      [parameter.name]: { status, options },
    }));
  }

  onDownloadCSV(): void {
    if (!this.canRun()) return;
    this.isLoading.set(true);

    this.reportExecution.downloadCsv(this.reportName(), this.collectedValues()).subscribe({
      next: (data) => {
        this.download.saveText(data, this.csvFilename(), 'text/csv;charset=utf-8;');
        this.isLoading.set(false);
      },
      error: () => this.handleRunError(),
    });
  }

  onRun(): void {
    if (!this.canRun()) return;
    this.isLoading.set(true);

    this.reportExecution.runReport(this.reportName(), this.collectedValues()).subscribe({
      next: (data) => {
        const result = data as Record<string, unknown>;
        this.reportData.set(result);
        const columnHeaders = (result['columnHeaders'] as Record<string, unknown>[]) || [];
        this.columnHeaders.set(columnHeaders);
        this.displayedColumns.set(columnHeaders.map((header) => header['columnName'] as string));
        const dataRows = (result['data'] as Record<string, unknown>[]) || [];
        this.dataRows.set(dataRows);
        this.rows.set(dataRows);
        this.pageIndex.set(0);
        this.isLoading.set(false);
      },
      error: () => this.handleRunError(),
    });
  }

  downloadCSV(): void {
    const displayedColumns = this.displayedColumns();
    const dataRows = this.dataRows();
    if (!displayedColumns.length || !dataRows.length) {
      return;
    }
    const csvRows: string[] = [];
    csvRows.push(displayedColumns.map((col) => `"${col.replaceAll('"', '""')}"`).join(','));

    for (const row of dataRows) {
      const values = displayedColumns.map((_, i) => {
        const val = this.getReportCellValue(row, i);
        return `"${val.replaceAll('"', '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    // The BOM makes Excel read the file as UTF-8; without it, accented client names in a
    // report downloaded on a Windows machine open as mojibake.
    this.download.saveText(
      '\uFEFF' + csvRows.join('\n'),
      this.csvFilename(),
      'text/csv;charset=utf-8;',
    );
  }

  onCancel(): void {
    this.router.navigate(['/reporting']);
  }

  getReportCellValue(row: Record<string, unknown>, index: number): string {
    const rowData = row['row'];
    if (rowData && Array.isArray(rowData)) {
      const val = rowData[index];
      if (val === null || val === undefined) {
        return '';
      }
      if (Array.isArray(val) && val.length >= 3) {
        return new Date(val[0], val[1] - 1, val[2]).toLocaleDateString();
      }
      return String(val);
    }
    return '';
  }

  private loadParameters(reportName: string): void {
    this.isParametersLoading.set(true);
    this.parametersLoaded.set(false);
    this.parameterLoadFailed.set(false);
    this.parameters.set([]);
    this.parameterValues.set({});
    this.dependentOptions.set({});

    this.reportExecution.getReportParameters(reportName).subscribe({
      next: (parameters) => {
        this.parameters.set(parameters);
        this.parameterValues.set(
          Object.fromEntries(
            parameters
              .filter((parameter) => parameter.displayType === 'none')
              .map((parameter) => [parameter.queryParameter, String(parameter.defaultValue ?? '')]),
          ),
        );
        this.parametersLoaded.set(true);
        this.isParametersLoading.set(false);
      },
      error: () => {
        this.parameterLoadFailed.set(true);
        this.isParametersLoading.set(false);
        this.notifications.error(this.translate.instant('REPORTS.PARAMETERS_LOAD_FAILED'));
      },
    });
  }

  private collectedValues(): ReportParameterValues {
    const current = this.parameterValues();
    return Object.fromEntries(
      this.parameters().map((parameter) => {
        const value = current[parameter.queryParameter];
        return [
          parameter.queryParameter,
          parameter.displayType === 'date' ? toIsoDate(String(value)) : value,
        ];
      }),
    );
  }

  private hasValue(value: string | number | undefined): boolean {
    return value !== undefined && String(value).trim().length > 0;
  }

  private handleRunError(): void {
    this.notifications.error(this.translate.instant('COMMON.ERROR'));
    this.isLoading.set(false);
  }

  private safeIdentifier(value: string): string {
    return value.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
  }

  /** Filename shared by both CSV paths, so they cannot drift apart. */
  private csvFilename(): string {
    return `${this.reportName().replaceAll(/\s+/g, '_')}_Report.csv`;
  }
}
