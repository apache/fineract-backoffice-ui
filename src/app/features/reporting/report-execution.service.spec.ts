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

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigService } from '../../core/services/config.service';
import { ReportExecutionService, ReportParameter } from './report-execution.service';

describe('ReportExecutionService', () => {
  const REPORT_NAME = 'Client Listing';
  const OUTPUT_TYPE = 'output-type';
  const FULL_PARAMETER_LIST_URL = '/api/v1/runreports/FullParameterList';
  const HEAD_OFFICE = 'Head Office';
  const OFFICE_LOOKUP_URL = '/api/v1/runreports/OfficeIdSelectOne';
  let service: ReportExecutionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportExecutionService,
        { provide: ConfigService, useValue: { apiUrl: '/api/v1' } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ReportExecutionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('discovers parameters and loads each select parameter from its own lookup', () => {
    let discovered = false;
    service.getReportParameters('Portfolio at Risk').subscribe((parameters) => {
      discovered = true;
      expect(parameters).toHaveSize(2);
      expect(parameters[0].queryParameter).toBe('R_officeId');
      expect(parameters[0].options).toEqual([
        { id: 1, name: HEAD_OFFICE },
        { id: '-1', name: '', isAll: true },
      ]);
      expect(parameters[1].displayType).toBe('date');
    });

    const template = http.expectOne((request) => request.url === FULL_PARAMETER_LIST_URL);
    expect(template.request.params.get('R_reportListing')).toBe('Portfolio at Risk');
    expect(template.request.params.get('parameterType')).toBe('true');
    template.flush({
      data: [
        {
          row: [
            'OfficeIdSelectAll',
            'officeId',
            'Office',
            'select',
            'number',
            '0',
            null,
            'Y',
            null,
          ],
        },
        {
          row: [
            'startDateSelect',
            'startDate',
            'From Date',
            'date',
            'date',
            'today',
            null,
            null,
            null,
          ],
        },
      ],
    });

    const lookup = http.expectOne(
      (request) => request.url === '/api/v1/runreports/OfficeIdSelectAll',
    );
    expect(lookup.request.params.get('parameterType')).toBe('true');
    lookup.flush({ data: [{ row: [1, HEAD_OFFICE] }] });
    expect(discovered).toBeTrue();
  });

  it('keeps cascading selects empty until their parent has a value', () => {
    service.getReportParameters('Active Loans - Summary').subscribe((parameters) => {
      expect(parameters).toHaveSize(2);
      expect(parameters[0].options).toEqual([{ id: 1, name: HEAD_OFFICE }]);
      expect(parameters[1].queryParameter).toBe('R_loanOfficerId');
      expect(parameters[1].parentParameterName).toBe('OfficeIdSelectOne');
      expect(parameters[1].options).toEqual([]);
    });

    http
      .expectOne((request) => request.url === FULL_PARAMETER_LIST_URL)
      .flush({
        data: [
          {
            row: [
              'OfficeIdSelectOne',
              'officeId',
              'Office',
              'select',
              'number',
              '0',
              null,
              null,
              null,
            ],
          },
          {
            row: [
              'loanOfficerIdSelectAll',
              'loanOfficerId',
              'Loan Officer',
              'select',
              'number',
              '0',
              null,
              null,
              'OfficeIdSelectOne',
            ],
          },
        ],
      });

    http.expectNone((request) => request.url === '/api/v1/runreports/loanOfficerIdSelectAll');
    http
      .expectOne((request) => request.url === OFFICE_LOOKUP_URL)
      .flush({ data: [{ row: [1, HEAD_OFFICE] }] });
  });

  it('isolates a failed lookup instead of dropping the parameter form', () => {
    service.getReportParameters('Tenant Report').subscribe((parameters) => {
      expect(parameters).toHaveSize(2);
      expect(parameters[0].options).toEqual([]);
      // Recorded, so the field can distinguish "no offices" from "offices unknown".
      expect(parameters[0].optionsFailed).toBeTrue();
      expect(parameters[1].options).toEqual([{ id: 'USD', name: 'US Dollar' }]);
      expect(parameters[1].optionsFailed).toBeFalse();
    });

    http
      .expectOne((request) => request.url === FULL_PARAMETER_LIST_URL)
      .flush({
        data: [
          {
            row: [
              'OfficeIdSelectOne',
              'officeId',
              'Office',
              'select',
              'number',
              '0',
              null,
              null,
              null,
            ],
          },
          {
            row: [
              'currencyIdSelectAll',
              'currencyId',
              'Currency',
              'select',
              'string',
              '',
              null,
              null,
              null,
            ],
          },
        ],
      });

    http
      .expectOne((request) => request.url === OFFICE_LOOKUP_URL)
      .flush('Lookup failed', { status: 403, statusText: 'Forbidden' });
    http
      .expectOne((request) => request.url === '/api/v1/runreports/currencyIdSelectAll')
      .flush({ data: [{ row: ['USD', 'US Dollar'] }] });
  });

  /**
   * The parent value travels under the *parent's* query parameter, because that is the name the
   * lookup SQL is written against — `R_currencyId` for a lookup selecting on `${currencyId}`.
   */
  it('scopes a dependent lookup by the parent query parameter', () => {
    const product: ReportParameter = {
      name: 'loanProductIdSelectAll',
      variable: 'loanProductId',
      label: 'Product',
      displayType: 'select',
      formatType: 'number',
      defaultValue: '0',
      selectOne: null,
      selectAll: 'Y',
      parentParameterName: 'currencyIdSelectAll',
      queryParameter: 'R_loanProductId',
      options: [],
      optionsFailed: false,
    };

    service.getDependentOptions(product, 'R_currencyId', 'EUR').subscribe((options) => {
      // "All" is appended because the parameter declares it, not because the lookup returned it.
      expect(options).toEqual([
        { id: 39, name: 'Probe EUR Product' },
        { id: '-1', name: '', isAll: true },
      ]);
    });

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/runreports/loanProductIdSelectAll',
    );
    expect(request.request.params.get('parameterType')).toBe('true');
    expect(request.request.params.get('R_currencyId')).toBe('EUR');
    request.flush({ data: [{ row: [39, 'Probe EUR Product'] }] });
  });

  /**
   * A parameter naming a parent the report does not declare could never become selectable, so it
   * is loaded like any independent parameter rather than left permanently empty.
   */
  it('loads a parameter whose declared parent is absent from the report', () => {
    service.getReportParameters('Odd Report').subscribe((parameters) => {
      expect(parameters[0].options).toEqual([{ id: 1, name: HEAD_OFFICE }]);
    });

    http
      .expectOne((request) => request.url === FULL_PARAMETER_LIST_URL)
      .flush({
        data: [
          {
            row: [
              'OfficeIdSelectOne',
              'officeId',
              'Office',
              'select',
              'number',
              '0',
              null,
              null,
              'SomeParameterNotInThisReport',
            ],
          },
        ],
      });

    http
      .expectOne((request) => request.url === OFFICE_LOOKUP_URL)
      .flush({ data: [{ row: [1, HEAD_OFFICE] }] });
  });

  it('sends every named report parameter without relying on positional arguments', () => {
    service
      .runReport(REPORT_NAME, {
        R_officeId: 1,
        R_loanOfficerId: 42,
        R_accountNo: '000123',
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/runreports/Client%20Listing',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual([
      'R_accountNo',
      'R_loanOfficerId',
      'R_officeId',
      'exportCSV',
      OUTPUT_TYPE,
    ]);
    expect(request.request.params.get('R_officeId')).toBe('1');
    expect(request.request.params.get('R_loanOfficerId')).toBe('42');
    expect(request.request.params.get('R_accountNo')).toBe('000123');
    expect(request.request.params.get('exportCSV')).toBe('false');
    expect(request.request.params.get(OUTPUT_TYPE)).toBe('HTML');
    request.flush({ columnHeaders: [], data: [] });
  });

  it('requests CSV output while preserving the same dynamic parameter map', () => {
    service.downloadCsv(REPORT_NAME, { R_officeId: 2 }).subscribe((csv) => {
      expect(csv).toContain('Client ID');
    });

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/runreports/Client%20Listing',
    );
    expect(request.request.responseType).toBe('text');
    expect(request.request.params.get('R_officeId')).toBe('2');
    expect(request.request.params.get('exportCSV')).toBe('true');
    expect(request.request.params.get(OUTPUT_TYPE)).toBe('CSV');
    request.flush('Client ID,Display Name');
  });

  it('skips malformed template rows without dropping valid parameters', () => {
    service.getReportParameters('Tenant Report').subscribe({
      next: (parameters) => {
        expect(parameters).toHaveSize(1);
        expect(parameters[0].queryParameter).toBe('R_startDate');
      },
      error: fail,
    });

    http
      .expectOne((request) => request.url === FULL_PARAMETER_LIST_URL)
      .flush({
        data: [
          { row: ['missing-fields'] },
          {
            row: [
              'startDateSelect',
              'startDate',
              'From Date',
              'date',
              'date',
              'today',
              null,
              null,
              null,
            ],
          },
        ],
      });
  });
});
