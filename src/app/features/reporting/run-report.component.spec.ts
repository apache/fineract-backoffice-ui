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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NotificationService } from '../../core/services/notification.service';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { ReportExecutionService, ReportParameter, ReportResult } from './report-execution.service';
import { RunReportComponent } from './run-report.component';

describe('RunReportComponent', () => {
  const REPORT_NAME = 'Active Clients';
  const HEAD_OFFICE = 'Head Office';
  const BAR_CHART = '[data-testid="report-chart-bar"]';
  const REPORT_TABLE = '[data-testid="report-table"]';
  let component: RunReportComponent;
  let fixture: ComponentFixture<RunReportComponent>;
  let reportExecutionSpy: jasmine.SpyObj<ReportExecutionService>;

  const parameter = (
    variable: string,
    label: string,
    displayType: string,
    options: ReportParameter['options'] = [],
    overrides: Partial<ReportParameter> = {},
  ): ReportParameter => ({
    name: `${variable}Parameter`,
    variable,
    label,
    displayType,
    formatType: displayType === 'date' ? 'date' : 'string',
    defaultValue: displayType === 'none' ? 'hidden-value' : null,
    selectOne: null,
    selectAll: null,
    parentParameterName: null,
    queryParameter: `R_${variable}`,
    options,
    optionsFailed: false,
    ...overrides,
  });

  const office = parameter('officeId', 'Office', 'select', [{ id: 1, name: HEAD_OFFICE }]);
  const loanOfficer = parameter('loanOfficerId', 'Loan Officer', 'select', [
    { id: 42, name: 'Ada Officer' },
  ]);
  const fromDate = parameter('fromDate', 'From Date', 'date');
  const toDate = parameter('toDate', 'To Date', 'date');
  const accountNumber = parameter('accountNo', 'Account Number', 'text');

  beforeEach(async () => {
    reportExecutionSpy = jasmine.createSpyObj('ReportExecutionService', [
      'getReportParameters',
      'runReport',
      'downloadCsv',
      'getDependentOptions',
    ]);

    await TestBed.configureTestingModule({
      imports: [RunReportComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ReportExecutionService, useValue: reportExecutionSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', ['error']),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ reportName: REPORT_NAME })),
            queryParamMap: of(convertToParamMap({ type: 'Table' })),
          },
        },
        provideIonicTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  function create(
    parameters: ReportParameter[],
    queryParams: Record<string, string> = { type: 'Table' },
  ): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        paramMap: of(convertToParamMap({ reportName: REPORT_NAME })),
        queryParamMap: of(convertToParamMap(queryParams)),
      },
    });
    reportExecutionSpy.getReportParameters.and.returnValue(of(parameters));
    fixture = TestBed.createComponent(RunReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function viewOf(variable: string) {
    const view = component.parameterViews().find((v) => v.parameter.variable === variable);
    if (!view) throw new Error(`No parameter view for ${variable}`);
    return view;
  }

  it('should create and read the report name from the route', () => {
    create([office]);

    expect(component).toBeTruthy();
    expect(component.reportName()).toBe(REPORT_NAME);
    expect(reportExecutionSpy.getReportParameters).toHaveBeenCalledOnceWith(REPORT_NAME);
  });

  it('renders all five declared visible parameters using their display types', () => {
    create([office, loanOfficer, fromDate, toDate, accountNumber]);

    const controls = fixture.nativeElement.querySelectorAll(
      'ion-item[data-testid^="report-parameter-"]',
    );
    expect(controls).toHaveSize(5);
    expect(
      fixture.nativeElement.querySelector('[data-testid="report-parameter-officeId"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="report-parameter-fromDate"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="report-parameter-accountNo"]'),
    ).not.toBeNull();
  });

  it('renders only Office when it is the only declared parameter', () => {
    create([office]);

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="report-parameter-officeId"]'),
    ).toHaveSize(1);
    expect(
      fixture.nativeElement.querySelectorAll('ion-item[data-testid^="report-parameter-"]'),
    ).toHaveSize(1);
  });

  it('passes hidden defaults without rendering a control', () => {
    const hidden = parameter('tenantScope', 'Tenant Scope', 'none');
    reportExecutionSpy.runReport.and.returnValue(of({ columnHeaders: [], data: [] }));
    create([hidden]);

    expect(
      fixture.nativeElement.querySelector('[data-testid="report-parameter-tenantScope"]'),
    ).toBeNull();
    expect(component.canRun()).toBeTrue();
    component.onRun();
    expect(reportExecutionSpy.runReport).toHaveBeenCalledOnceWith(REPORT_NAME, {
      R_tenantScope: 'hidden-value',
    });
  });

  it('passes the full collected value map to the report call', () => {
    const result: ReportResult = { columnHeaders: [], data: [] };
    reportExecutionSpy.runReport.and.returnValue(of(result));
    create([office, loanOfficer, fromDate, toDate, accountNumber]);

    component.setParameterValue(office, 1);
    component.setParameterValue(loanOfficer, 42);
    component.setParameterValue(fromDate, '2026-08-01T00:00:00.000Z');
    component.setParameterValue(toDate, '2026-08-09T00:00:00.000Z');
    component.setParameterValue(accountNumber, '000123');
    component.onRun();

    expect(reportExecutionSpy.runReport).toHaveBeenCalledOnceWith(REPORT_NAME, {
      R_officeId: 1,
      R_loanOfficerId: 42,
      R_fromDate: '2026-08-01',
      R_toDate: '2026-08-09',
      R_accountNo: '000123',
    });
  });

  it('blocks a report that declares an unsupported display type', () => {
    create([parameter('customFilter', 'Custom Filter', 'range')]);

    expect(component.canRun()).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('[data-testid="report-parameters-unsupported"]')
        .textContent,
    ).toContain('Custom Filter (range)');
  });

  describe('dependent parameters', () => {
    const currency = parameter('currencyId', 'Currency', 'select', [
      { id: 'USD', name: 'US Dollar' },
      { id: 'EUR', name: 'Euro' },
    ]);
    const product = parameter('loanProductId', 'Product', 'select', [], {
      parentParameterName: currency.name,
      selectAll: 'Y',
    });

    const usdProducts = [{ id: 7, name: 'USD Loan' }];
    const eurProducts = [{ id: 9, name: 'EUR Loan' }];

    it('disables a dependent control until its parent has a value', () => {
      create([currency, product]);

      expect(viewOf('loanProductId').disabled).toBeTrue();
      expect(viewOf('loanProductId').waitingForParent).toBeTrue();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="report-parameter-loanProductId-waiting"]',
        ),
      ).not.toBeNull();
      // Nothing is fetched for it while it cannot be used.
      expect(reportExecutionSpy.getDependentOptions).not.toHaveBeenCalled();
    });

    it('scopes the child lookup by the parent parameter that carries the value', () => {
      reportExecutionSpy.getDependentOptions.and.returnValue(of(usdProducts));
      create([currency, product]);

      component.setParameterValue(currency, 'USD');
      fixture.detectChanges();

      expect(reportExecutionSpy.getDependentOptions).toHaveBeenCalledOnceWith(
        product,
        'R_currencyId',
        'USD',
      );
      expect(viewOf('loanProductId').options).toEqual(usdProducts);
      expect(viewOf('loanProductId').disabled).toBeFalse();
    });

    /**
     * The point of the issue: a stale child selection survives a parent change and silently
     * filters the report to something the user did not ask for.
     */
    it('clears the child selection when the parent changes, rather than only refetching', () => {
      reportExecutionSpy.getDependentOptions.and.returnValue(of(usdProducts));
      create([currency, product]);

      component.setParameterValue(currency, 'USD');
      component.setParameterValue(product, 7);
      expect(component.parameterValue(product)).toBe(7);

      reportExecutionSpy.getDependentOptions.and.returnValue(of(eurProducts));
      component.setParameterValue(currency, 'EUR');
      fixture.detectChanges();

      expect(component.parameterValue(product)).toBeUndefined();
      expect(viewOf('loanProductId').options).toEqual(eurProducts);
      expect(component.canRun()).toBeFalse();
    });

    it('clears a grandchild when the top of the chain changes', () => {
      const purpose = parameter('loanPurposeId', 'Purpose', 'select', [], {
        parentParameterName: product.name,
      });
      reportExecutionSpy.getDependentOptions.and.returnValue(of(usdProducts));
      create([currency, product, purpose]);

      component.setParameterValue(currency, 'USD');
      component.setParameterValue(product, 7);
      component.setParameterValue(purpose, 3);

      component.setParameterValue(currency, 'EUR');

      expect(component.parameterValue(product)).toBeUndefined();
      expect(component.parameterValue(purpose)).toBeUndefined();
    });

    /**
     * A dependent lookup can fail for reasons the user cannot act on — the stock loan-officer
     * lookup fails outright on PostgreSQL. An empty dropdown would read as "no products exist".
     */
    it('shows an error state on a failed lookup instead of an empty dropdown', () => {
      reportExecutionSpy.getDependentOptions.and.returnValue(throwError(() => new Error('boom')));
      create([currency, product]);

      component.setParameterValue(currency, 'USD');
      fixture.detectChanges();

      expect(viewOf('loanProductId').failed).toBeTrue();
      expect(
        fixture.nativeElement.querySelector('[data-testid="report-parameter-loanProductId-error"]'),
      ).not.toBeNull();
      // "All" is declared by the parameter, not discovered by the lookup, so it survives the
      // failure and keeps the report runnable unfiltered.
      expect(viewOf('loanProductId').options).toEqual([{ id: '-1', name: '', isAll: true }]);
    });

    it('leaves a failed lookup with no All option unrunnable', () => {
      const strict = parameter('branchId', 'Branch', 'select', [], {
        parentParameterName: currency.name,
      });
      reportExecutionSpy.getDependentOptions.and.returnValue(throwError(() => new Error('boom')));
      create([currency, strict]);

      component.setParameterValue(currency, 'USD');
      fixture.detectChanges();

      expect(viewOf('branchId').options).toEqual([]);
      expect(component.canRun()).toBeFalse();
    });
  });

  describe('report type', () => {
    const chartResult: ReportResult = {
      columnHeaders: [
        { columnName: 'Office', columnDisplayType: 'STRING' },
        { columnName: 'Clients', columnDisplayType: 'INTEGER' },
      ],
      data: [{ row: [HEAD_OFFICE, 58] }, { row: ['Branch', 2] }],
    };

    it('renders a bar chart for a chart report rather than a table', () => {
      reportExecutionSpy.runReport.and.returnValue(of(chartResult));
      create([], { type: 'Chart', subType: 'Bar' });

      component.onRun();
      fixture.detectChanges();

      expect(component.chartSeries()).toEqual([
        { label: HEAD_OFFICE, value: 58, color: jasmine.any(String) },
        { label: 'Branch', value: 2, color: jasmine.any(String) },
      ]);
      expect(fixture.nativeElement.querySelector(BAR_CHART)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(REPORT_TABLE)).toBeNull();
    });

    it('renders the pie sub-type through the donut chart', () => {
      reportExecutionSpy.runReport.and.returnValue(of(chartResult));
      create([], { type: 'Chart', subType: 'Pie' });

      component.onRun();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="report-chart-pie"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector(BAR_CHART)).toBeNull();
    });

    it('keeps rendering a table for a table report', () => {
      reportExecutionSpy.runReport.and.returnValue(of(chartResult));
      create([], { type: 'Table' });

      component.onRun();
      fixture.detectChanges();

      expect(component.chartSeries()).toEqual([]);
      expect(fixture.nativeElement.querySelector(REPORT_TABLE)).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="report-chart"]')).toBeNull();
    });

    /** A definition can claim to be a chart and return nothing plottable. */
    it('falls back to the table, and says why, when a chart report has no numeric column', () => {
      reportExecutionSpy.runReport.and.returnValue(
        of({
          columnHeaders: [
            { columnName: 'Office', columnDisplayType: 'STRING' },
            { columnName: 'Status', columnDisplayType: 'STRING' },
          ],
          data: [{ row: [HEAD_OFFICE, 'Active'] }],
        }),
      );
      create([], { type: 'Chart', subType: 'Bar' });

      component.onRun();
      fixture.detectChanges();

      expect(component.chartUnavailable()).toBeTrue();
      expect(
        fixture.nativeElement.querySelector('[data-testid="report-chart-unavailable"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector(REPORT_TABLE)).not.toBeNull();
    });
  });
});
