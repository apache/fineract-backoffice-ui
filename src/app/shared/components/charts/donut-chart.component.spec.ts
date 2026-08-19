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
import { DonutChartComponent, ChartData } from './donut-chart.component';

describe('DonutChartComponent', () => {
  let component: DonutChartComponent;
  let fixture: ComponentFixture<DonutChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonutChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DonutChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and handle empty data', () => {
    expect(component).toBeTruthy();
    expect(component.total()).toBe(0);
    expect(component.segments()).toHaveSize(0);
  });

  it('should compute total and segments for valid data input', () => {
    const mockData: ChartData[] = [
      { label: 'Active', value: 30, color: 'green' },
      { label: 'Inactive', value: 10, color: 'red' },
    ];
    fixture.componentRef.setInput('data', mockData);
    fixture.detectChanges();

    expect(component.total()).toBe(40);
    expect(component.segments()).toHaveSize(2);

    const firstSegment = component.segments()[0];
    const secondSegment = component.segments()[1];

    // Total circumference = 2 * Math.PI * 40 ~= 251.327
    const circumference = 2 * Math.PI * 40;

    expect(Number.parseFloat(firstSegment.dashArray.split(' ', 1)[0])).toBeCloseTo(
      0.75 * circumference,
      1,
    );
    expect(Number.parseFloat(secondSegment.dashArray.split(' ', 1)[0])).toBeCloseTo(
      0.25 * circumference,
      1,
    );

    // First offset is 0, second cumulative offset is -75% of circumference
    expect(Number.parseFloat(firstSegment.dashOffset)).toBe(0);
    expect(Number.parseFloat(secondSegment.dashOffset)).toBeCloseTo(-0.75 * circumference, 1);
  });

  it('should render correct legend items', () => {
    const mockData: ChartData[] = [
      { label: 'Active', value: 30, color: 'green' },
      { label: 'Inactive', value: 10, color: 'red' },
    ];
    fixture.componentRef.setInput('data', mockData);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const legendItems = compiled.querySelectorAll('.legend-item');
    expect(legendItems).toHaveSize(2);

    expect(legendItems[0].querySelector('.label')?.textContent).toContain('Active');
    expect(legendItems[0].querySelector('.value')?.textContent).toContain('30');
    expect(legendItems[1].querySelector('.label')?.textContent).toContain('Inactive');
    expect(legendItems[1].querySelector('.value')?.textContent).toContain('10');
  });
});
