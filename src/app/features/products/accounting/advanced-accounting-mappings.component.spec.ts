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

import { AdvancedAccountingMappingsComponent } from './advanced-accounting-mappings.component';
import {
  ACCOUNTING_RULE,
  advancedMappingsForRequest,
  advancedMappingsFromResponse,
  emptyAdvancedMappings,
} from './product-accounting.model';
import { provideFakeAdapters } from '../../../testing/adapters';

const PAYMENT_TYPES = [
  { id: 1, name: 'Cash' },
  { id: 2, name: 'Mobile Money' },
];

const CHARGES = [
  { id: 10, name: 'Processing fee', penalty: false },
  { id: 11, name: 'Insurance fee', penalty: false },
  { id: 20, name: 'Late fee', penalty: true },
];

describe('AdvancedAccountingMappingsComponent', () => {
  let fixture: ComponentFixture<AdvancedAccountingMappingsComponent>;
  let component: AdvancedAccountingMappingsComponent;

  beforeEach(async () => {
    const adapters = provideFakeAdapters();

    await TestBed.configureTestingModule({
      imports: [AdvancedAccountingMappingsComponent],
      providers: [provideNoopAnimations(), ...adapters.providers],
    }).compileComponents();

    fixture = TestBed.createComponent(AdvancedAccountingMappingsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accountingRule', ACCOUNTING_RULE.CASH);
    fixture.componentRef.setInput('paymentTypeOptions', PAYMENT_TYPES);
    fixture.componentRef.setInput('charges', CHARGES);
    fixture.componentRef.setInput('accountOptions', {
      assetAccountOptions: [{ id: 1, name: 'Till', glCode: '10101' }],
      incomeAccountOptions: [{ id: 3, name: 'Fee income', glCode: '40101' }],
    });
    fixture.componentRef.setInput('mappings', emptyAdvancedMappings());
    fixture.detectChanges();
  });

  it('stays hidden while the product posts nothing to the ledger', () => {
    fixture.componentRef.setInput('accountingRule', ACCOUNTING_RULE.NONE);
    fixture.detectChanges();

    expect(component.visible()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-testid="payment-channel-add"]')).toBeNull();
  });

  it('adds and removes payment channel rows', () => {
    component.addPaymentChannel();
    component.setPaymentChannel(0, 'paymentTypeId', 1);
    component.setPaymentChannel(0, 'fundSourceAccountId', 1);

    expect(component.mappings().paymentChannelToFundSourceMappings).toEqual([
      { paymentTypeId: 1, fundSourceAccountId: 1 },
    ]);

    component.removePaymentChannel(0);
    expect(component.mappings().paymentChannelToFundSourceMappings).toEqual([]);
  });

  /**
   * The platform accepts two rows naming the same payment type and then fires neither reliably,
   * so the second row must not be able to name it.
   */
  it('stops a payment type being routed twice', () => {
    component.addPaymentChannel();
    component.setPaymentChannel(0, 'paymentTypeId', 1);

    // Offered to its own row, so the current selection stays visible…
    expect(component.paymentChannelRows()[0].paymentTypes.map((option) => option.id)).toEqual([
      1, 2,
    ]);
    // …and withheld from any row that has yet to choose.
    expect(component.unusedPaymentTypes().map((option) => option.id)).toEqual([2]);

    component.addPaymentChannel();
    component.setPaymentChannel(1, 'paymentTypeId', 2);
    expect(component.canAddPaymentChannel()).toBeFalse();
  });

  /**
   * A fee mapping naming a penalty charge is accepted by the platform and never fires, so the
   * two tables are drawn from opposite sides of the flag.
   */
  it('offers fees and penalties from opposite sides of the penalty flag', () => {
    expect(component.chargesFor(false).map((charge) => charge.id)).toEqual([10, 11]);
    expect(component.chargesFor(true).map((charge) => charge.id)).toEqual([20]);
  });

  it('reports that there is nothing to map when the product carries no charges', () => {
    fixture.componentRef.setInput('charges', []);
    fixture.detectChanges();

    expect(component.chargesFor(false)).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="fee-mapping-none"]')).not.toBeNull();
  });

  it('keeps the fee and penalty tables apart', () => {
    component.addChargeMapping(false);
    component.setChargeMapping(false, 0, 'chargeId', 10);
    component.addChargeMapping(true);
    component.setChargeMapping(true, 0, 'chargeId', 20);

    expect(component.mappings().feeToIncomeAccountMappings).toEqual([{ chargeId: 10 }]);
    expect(component.mappings().penaltyToIncomeAccountMappings).toEqual([{ chargeId: 20 }]);
  });

  /** The parent reads this from a signal at submit; a mutation in place would not notify it. */
  it('replaces the mappings object rather than writing into it', () => {
    const before = component.mappings();
    component.addPaymentChannel();

    expect(component.mappings()).not.toBe(before);
  });
});

describe('advanced mapping payloads', () => {
  it('omits a table that has no complete rows', () => {
    const mappings = emptyAdvancedMappings();
    // A row the user added but never filled in must not be posted as `{}`.
    mappings.paymentChannelToFundSourceMappings = [{}, { paymentTypeId: 1 }];
    mappings.feeToIncomeAccountMappings = [{ chargeId: 10, incomeAccountId: 3 }];

    const request = advancedMappingsForRequest(ACCOUNTING_RULE.CASH, mappings);

    expect('paymentChannelToFundSourceMappings' in request).toBeFalse();
    expect(request['feeToIncomeAccountMappings']).toEqual([{ chargeId: 10, incomeAccountId: 3 }]);
    expect('penaltyToIncomeAccountMappings' in request).toBeFalse();
  });

  it('sends nothing at all under a rule that posts nothing', () => {
    const mappings = emptyAdvancedMappings();
    mappings.feeToIncomeAccountMappings = [{ chargeId: 10, incomeAccountId: 3 }];

    expect(advancedMappingsForRequest(ACCOUNTING_RULE.NONE, mappings)).toEqual({});
  });

  /**
   * The request and response disagree about every key. Feeding the response back unchanged would
   * show empty selects on a configured product and blank its mappings on the next save.
   */
  it('reads the response shape back into the request shape', () => {
    const mappings = advancedMappingsFromResponse({
      paymentChannelToFundSourceMappings: [
        { paymentType: { id: 1 }, fundSourceAccount: { id: 7 } },
      ],
      feeToIncomeAccountMappings: [{ charge: { id: 10 }, incomeAccount: { id: 3 } }],
      penaltyToIncomeAccountMappings: [{ charge: { id: 20 }, incomeAccount: { id: 4 } }],
    });

    expect(mappings.paymentChannelToFundSourceMappings).toEqual([
      { paymentTypeId: 1, fundSourceAccountId: 7 },
    ]);
    expect(mappings.feeToIncomeAccountMappings).toEqual([{ chargeId: 10, incomeAccountId: 3 }]);
    expect(mappings.penaltyToIncomeAccountMappings).toEqual([{ chargeId: 20, incomeAccountId: 4 }]);
  });

  it('survives a product with no advanced mappings at all', () => {
    expect(advancedMappingsFromResponse(undefined)).toEqual(emptyAdvancedMappings());
    expect(advancedMappingsFromResponse({})).toEqual(emptyAdvancedMappings());
  });
});
