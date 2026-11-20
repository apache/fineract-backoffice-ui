/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
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

import { WcLoanFormComponent } from './wc-loan-form.component';

import {
  DataTablesService,
  EntityDataTableService,
  WorkingCapitalLoansService,
  WorkingCapitalNearBreachService,
} from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { DatatableEntryDialogComponent } from '../../../shared/components/datatable-entry-dialog/datatable-entry-dialog.component';

import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { of } from 'rxjs';

import { provideTranslateTesting } from '../../../testing/i18n-testing';

import { provideNoopAnimations } from '@angular/platform-browser/animations';

/** The application the edit-mode suite modifies. Shaped as the loan resource returns it. */
const EDIT_LOAN = {
  id: 42,
  clientId: 7,
  loanProductId: 1,
  fundId: 3,
  externalId: 'WC-42',
  principal: 5000,
  totalPaymentVolume: 60_000,
  paymentRate: 5,
  repaymentEvery: 1,
  repaymentFrequencyType: { id: '0', code: 'DAYS', value: 'Days' },
  breach: { id: 2, name: 'Covenant A' },
  nearBreach: { id: 8, name: 'Near A' },
  delinquencyBucket: { id: 4, name: 'Bucket' },
  timeline: { submittedOnDate: '15 January 2026', expectedDisbursementDate: '20 January 2026' },
};

describe('WcLoanFormComponent', () => {
  let component: WcLoanFormComponent;

  let fixture: ComponentFixture<WcLoanFormComponent>;

  let serviceSpy: SpyObj<WorkingCapitalLoansService>;

  let nearBreachServiceSpy: SpyObj<WorkingCapitalNearBreachService>;

  let routerSpy: SpyObj<Router>;

  let entityChecksSpy: SpyObj<EntityDataTableService>;

  let datatablesSpy: SpyObj<DataTablesService>;

  let dialogSpy: SpyObj<DialogService>;

  /** Mutated by the edit suite before the shared `beforeEach` builds the TestBed. */
  let routeParams: Record<string, string>;

  /** One CREATE check on `m_wc_loan`, which is what makes the platform refuse the application. */
  const CREATE_CHECK = {
    id: 1,
    entity: 'm_wc_loan',
    status: { id: 100, code: 'statusEnum.create', value: 'CREATE' },
    datatableName: 'wc_kyc',
  };

  const KYC_TABLE = {
    registeredTableName: 'wc_kyc',
    applicationTableName: 'm_wc_loan',
    columnHeaderData: [
      { columnName: 'wc_loan_id', isColumnPrimaryKey: true },
      { columnName: 'reference', columnDisplayType: 'STRING' },
    ],
  };

  beforeEach(async () => {
    routeParams ??= {};
    serviceSpy = createSpyObj([
      'getWorkingCapitalLoansTemplate',
      'postWorkingCapitalLoans',
      'getWorkingCapitalLoansLoanId',
      'putWorkingCapitalLoansLoanId',
    ]);

    nearBreachServiceSpy = createSpyObj(['getWorkingCapitalNearBreach']);

    entityChecksSpy = createSpyObj(['getEntityDatatableChecks']);
    datatablesSpy = createSpyObj(['getDatatablesDatatable']);
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    // No checks by default, which is how most tenants are configured.
    entityChecksSpy.getEntityDatatableChecks.mockReturnValue(
      of({ pageItems: [] }) as unknown as ReturnType<
        EntityDataTableService['getEntityDatatableChecks']
      >,
    );
    datatablesSpy.getDatatablesDatatable.mockReturnValue(
      of(KYC_TABLE) as unknown as ReturnType<DataTablesService['getDatatablesDatatable']>,
    );

    routerSpy = createSpyObj(['navigate']);

    serviceSpy.getWorkingCapitalLoansTemplate.mockReturnValue(
      of({
        productOptions: [{ id: 1, name: 'WC Product' }],
        breachOptions: [{ id: 2, name: 'Covenant A' }],
        periodFrequencyTypeOptions: [{ id: '0', code: 'DAYS', value: 'Days' }],
      }) as unknown as ReturnType<WorkingCapitalLoansService['getWorkingCapitalLoansTemplate']>,
    );

    nearBreachServiceSpy.getWorkingCapitalNearBreach.mockReturnValue(
      of([]) as unknown as ReturnType<
        WorkingCapitalNearBreachService['getWorkingCapitalNearBreach']
      >,
    );

    // Stubbed for both suites: in edit mode `ngOnInit` loads the loan during the first change
    // detection below, which is before any inner hook could set this up.
    serviceSpy.getWorkingCapitalLoansLoanId.mockReturnValue(
      of(EDIT_LOAN) as unknown as ReturnType<
        WorkingCapitalLoansService['getWorkingCapitalLoansLoanId']
      >,
    );
    serviceSpy.putWorkingCapitalLoansLoanId.mockReturnValue(
      of({}) as unknown as ReturnType<WorkingCapitalLoansService['putWorkingCapitalLoansLoanId']>,
    );

    await TestBed.configureTestingModule({
      imports: [WcLoanFormComponent],

      providers: [
        ...provideTranslateTesting(),
        { provide: WorkingCapitalLoansService, useValue: serviceSpy },

        {
          provide: WorkingCapitalNearBreachService,
          useValue: nearBreachServiceSpy,
        },

        { provide: Router, useValue: routerSpy },

        { provide: EntityDataTableService, useValue: entityChecksSpy },

        { provide: DataTablesService, useValue: datatablesSpy },

        { provide: DialogService, useValue: dialogSpy },

        {
          // `loans/create` carries no :id; the edit suite below supplies one.
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(routeParams) } },
        },

        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcLoanFormComponent);

    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();

    expect(serviceSpy.getWorkingCapitalLoansTemplate).toHaveBeenCalled();

    expect(component.productOptions()).toHaveLength(1);

    expect(component.breachOptions()).toHaveLength(1);

    expect(component.repaymentFrequencyTypeOptions()).toHaveLength(1);
  });

  it('should post on submit and navigate to the list', () => {
    serviceSpy.postWorkingCapitalLoans.mockReturnValue(
      of({}) as unknown as ReturnType<WorkingCapitalLoansService['postWorkingCapitalLoans']>,
    );

    component.loan = {
      clientId: 7,
      productId: 1,
      principalAmount: 5000,
    };

    component.onSubmit();

    expect(serviceSpy.postWorkingCapitalLoans).toHaveBeenCalled();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loans']);
  });

  it('should format provided dates into the request', () => {
    serviceSpy.postWorkingCapitalLoans.mockReturnValue(
      of({}) as unknown as ReturnType<WorkingCapitalLoansService['postWorkingCapitalLoans']>,
    );

    component.loan = {
      clientId: 7,
      productId: 1,
      principalAmount: 5000,
    };

    component.submittedOnDate = '2026-01-15T12:00:00';

    component.onSubmit();

    const arg = serviceSpy.postWorkingCapitalLoans.mock.lastCall![0];

    expect(arg.submittedOnDate).toBe('15 January 2026');

    expect(arg.locale).toBe('en');
  });

  it('seeds the mandatory disbursement date and leaves the optional submitted date unset', () => {
    // `WorkingCapitalLoanApplicationDataValidator` documents `expectedDisbursementDate` as
    // mandatory and `submittedOnDate` as optional, substituting the platform's own current date
    // for the latter when it is absent. So one is seeded and the other is deliberately not:
    // leaving a mandatory date blank only buys a server-side refusal, and seeding an optional
    // one claims a choice the operator never made.
    expect(component.expectedDisbursementDate).not.toBeNull();
    expect(component.submittedOnDate).toBeNull();
  });

  /**
   * Issue #770: the loan screen offered Edit and navigated to a route that did not exist, and no
   * screen could modify a submitted application although Fineract supports it. The same form
   * serves both modes, so these tests pin the half that is not shared: what it loads, what it
   * sends, and that it sends only what changed.
   */
  describe('in edit mode', () => {
    beforeAll(() => {
      routeParams = { id: '42' };
    });

    afterAll(() => {
      routeParams = {};
    });

    it('prefills the form from the loan being modified', () => {
      expect(component.isEdit()).toBe(true);
      expect(component.loanId()).toBe(42);
      // The response and the request body name several of these differently; a mismatch here
      // silently blanks a field, which PUT would then read as "cleared".
      expect(component.loan.principalAmount).toBe(5000);
      expect(component.loan.periodPaymentRate).toBe(5);
      expect(component.loan.breachId).toBe(2);
      expect(component.loan.nearBreachId).toBe(8);
      expect(component.loan.delinquencyBucketId).toBe(4);
      expect(component.loan.repaymentFrequencyType).toBe('DAYS');
      expect(component.submittedOnDate).not.toBeNull();
    });

    it('puts to the loan and returns to it, rather than posting a second application', () => {
      component.onSubmit();

      expect(serviceSpy.putWorkingCapitalLoansLoanId).toHaveBeenCalled();
      expect(serviceSpy.postWorkingCapitalLoans).not.toHaveBeenCalled();
      expect(serviceSpy.putWorkingCapitalLoansLoanId.mock.lastCall![0]).toBe(42);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loans/view/42']);
    });

    it('sends only the fields the user changed', () => {
      component.loan.principalAmount = 6000;

      component.onSubmit();

      const body = serviceSpy.putWorkingCapitalLoansLoanId.mock.lastCall![1];
      expect(body.principalAmount).toBe(6000);
      // Untouched fields are absent: PUT is a modification command, and Fineract audits every
      // field it is handed as a change.
      expect(body.clientId).toBeUndefined();
      expect(body.productId).toBeUndefined();
      expect(body.locale).toBe('en');
    });

    it('cancels back to the loan instead of the list', () => {
      component.onCancel();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loans/view/42']);
    });
  });

  /**
   * Fineract's entity datatable checks refuse the application until the registered table has a
   * row — 403 "Please fill in the data table [x] before creating this working capital loan." —
   * and the create request carries the rows inline, so there is no loan to add one to
   * afterwards. The form collects them (issue #776).
   */
  describe('create-time datatable checks', () => {
    async function withCheck(): Promise<void> {
      entityChecksSpy.getEntityDatatableChecks.mockReturnValue(
        of({ pageItems: [CREATE_CHECK] }) as unknown as ReturnType<
          EntityDataTableService['getEntityDatatableChecks']
        >,
      );
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [WcLoanFormComponent],
        providers: [
          ...provideTranslateTesting(),
          { provide: WorkingCapitalLoansService, useValue: serviceSpy },
          { provide: WorkingCapitalNearBreachService, useValue: nearBreachServiceSpy },
          { provide: Router, useValue: routerSpy },
          { provide: EntityDataTableService, useValue: entityChecksSpy },
          { provide: DataTablesService, useValue: datatablesSpy },
          { provide: DialogService, useValue: dialogSpy },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({}) } },
          },
          provideNoopAnimations(),
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(WcLoanFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    }

    it('asks the platform only for the checks that apply to creating this loan', () => {
      expect(entityChecksSpy.getEntityDatatableChecks).toHaveBeenCalledWith(100, 'm_wc_loan');
    });

    it('requires nothing where the tenant has registered no checks', () => {
      expect(component.requiredDatatables()).toHaveLength(0);
      expect(component.hasOutstandingDatatables()).toBe(false);
    });

    it('reads the columns of each required table', async () => {
      await withCheck();

      expect(datatablesSpy.getDatatablesDatatable).toHaveBeenCalledWith('wc_kyc');
      expect(component.requiredDatatables()).toEqual([
        { name: 'wc_kyc', columns: KYC_TABLE.columnHeaderData },
      ]);
    });

    it('holds the application back while a required table is unfilled', async () => {
      await withCheck();

      expect(component.hasOutstandingDatatables()).toBe(true);
    });

    /**
     * Collected, not saved: the dialog is opened in its collect-only mode because there is no
     * loan id yet to post a row against.
     */
    it('collects the fields through the entry dialog and sends them with the application', async () => {
      await withCheck();
      dialogSpy.open.mockResolvedValue({ reference: 'KYC-1', locale: 'en' });

      await component.onFillRequiredDatatable(component.requiredDatatables()[0]);

      expect(dialogSpy.open).toHaveBeenCalledWith(
        DatatableEntryDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({ datatableName: 'wc_kyc', collectOnly: true }),
        }),
      );
      expect(component.hasOutstandingDatatables()).toBe(false);

      serviceSpy.postWorkingCapitalLoans.mockReturnValue(
        of({}) as unknown as ReturnType<WorkingCapitalLoansService['postWorkingCapitalLoans']>,
      );
      component.onSubmit();

      const request = serviceSpy.postWorkingCapitalLoans.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(request['datatables']).toEqual([
        { registeredTableName: 'wc_kyc', data: { reference: 'KYC-1', locale: 'en' } },
      ]);
    });

    it('sends no datatables key at all when nothing was collected', () => {
      serviceSpy.postWorkingCapitalLoans.mockReturnValue(
        of({}) as unknown as ReturnType<WorkingCapitalLoansService['postWorkingCapitalLoans']>,
      );

      component.onSubmit();

      const request = serviceSpy.postWorkingCapitalLoans.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(request['datatables']).toBeUndefined();
    });

    it('keeps what was entered when the dialog is dismissed', async () => {
      await withCheck();
      dialogSpy.open.mockResolvedValue({ reference: 'KYC-1' });
      await component.onFillRequiredDatatable(component.requiredDatatables()[0]);

      dialogSpy.open.mockResolvedValue(undefined);
      await component.onFillRequiredDatatable(component.requiredDatatables()[0]);

      expect(component.requiredDatatables()[0].data).toEqual({ reference: 'KYC-1' });
    });

    it('asks for no checks at all when modifying an existing application', async () => {
      entityChecksSpy.getEntityDatatableChecks.mockClear();
      routeParams = { id: '42' };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [WcLoanFormComponent],
        providers: [
          ...provideTranslateTesting(),
          { provide: WorkingCapitalLoansService, useValue: serviceSpy },
          { provide: WorkingCapitalNearBreachService, useValue: nearBreachServiceSpy },
          { provide: Router, useValue: routerSpy },
          { provide: EntityDataTableService, useValue: entityChecksSpy },
          { provide: DataTablesService, useValue: datatablesSpy },
          { provide: DialogService, useValue: dialogSpy },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }) } },
          },
          provideNoopAnimations(),
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(WcLoanFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // The check is on CREATE; a modification is not one, and the rows already exist.
      expect(entityChecksSpy.getEntityDatatableChecks).not.toHaveBeenCalled();
      routeParams = {};
    });
  });
});
