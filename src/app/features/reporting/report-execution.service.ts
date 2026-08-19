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

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ConfigService } from '../../core/services/config.service';

export interface ReportSelectOption {
  readonly id: string | number;
  readonly name: string;
  readonly isAll?: boolean;
}

export interface ReportParameter {
  readonly name: string;
  readonly variable: string;
  readonly label: string;
  readonly displayType: string;
  readonly formatType: string;
  readonly defaultValue: unknown;
  readonly selectOne: unknown;
  readonly selectAll: unknown;
  readonly parentParameterName: string | null;
  readonly queryParameter: string;
  readonly options: readonly ReportSelectOption[];
  /**
   * The lookup ran and failed.
   *
   * "No options" and "options unknown" are different things to a user choosing a filter, and an
   * empty dropdown says the first while meaning the second — the failure mode #223 was raised for.
   */
  readonly optionsFailed: boolean;
}

/** The sentinel the report SQL compares against for an unfiltered run. */
export const ALL_OPTION: ReportSelectOption = { id: '-1', name: '', isAll: true };

/**
 * Whether the parameter offers "All".
 *
 * This is declared by the parameter definition rather than discovered by the lookup, so it stays
 * knowable even when the lookup fails — which is what lets a broken dependent lookup degrade to an
 * unfiltered run instead of blocking the report outright.
 */
export function offersAllOption(parameter: Pick<ReportParameter, 'selectAll'>): boolean {
  return String(parameter.selectAll).toUpperCase() === 'Y';
}

export interface ReportResult {
  readonly columnHeaders?: readonly Record<string, unknown>[];
  readonly data?: readonly Record<string, unknown>[];
  readonly [key: string]: unknown;
}

interface GenericResultset {
  readonly data?: readonly { readonly row?: unknown }[];
}

export type ReportParameterValues = Readonly<Record<string, string | number>>;

/**
 * The generated run-reports client exposes only a fixed positional subset of report parameters.
 * Report definitions are dynamic, so this service deliberately uses a named query map instead.
 */
@Injectable({ providedIn: 'root' })
export class ReportExecutionService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  getReportParameters(reportName: string): Observable<ReportParameter[]> {
    const params = new HttpParams().set('R_reportListing', reportName).set('parameterType', 'true');

    return this.http.get<GenericResultset>(this.reportUrl('FullParameterList'), { params }).pipe(
      map((response) =>
        (response.data ?? [])
          .map((entry) => this.toReportParameter(entry.row))
          .filter((parameter): parameter is ReportParameter => parameter !== null),
      ),
      switchMap((parameters) => this.loadSelectOptions(parameters)),
    );
  }

  runReport(reportName: string, values: ReportParameterValues): Observable<ReportResult> {
    const params = this.buildRunParams(values, false, 'HTML');
    return this.http.get<ReportResult>(this.reportUrl(reportName), { params });
  }

  downloadCsv(reportName: string, values: ReportParameterValues): Observable<string> {
    const params = this.buildRunParams(values, true, 'CSV');
    return this.http.get(this.reportUrl(reportName), { params, responseType: 'text' });
  }

  /**
   * Fetches the options for one dependent parameter, scoped by its parent's current value.
   *
   * The platform substitutes the parent value into the lookup SQL by name, so the parent's own
   * `queryParameter` is what carries it — `R_officeId` for a lookup written against `${officeId}`.
   *
   * Failures are deliberately *not* swallowed here: the caller distinguishes a lookup that
   * returned nothing from one that never answered, and only the caller knows which parent
   * selection the failure belongs to.
   */
  getDependentOptions(
    parameter: ReportParameter,
    parentQueryParameter: string,
    parentValue: string | number,
  ): Observable<readonly ReportSelectOption[]> {
    const params = new HttpParams()
      .set('parameterType', 'true')
      .set(parentQueryParameter, String(parentValue));

    return this.http
      .get<GenericResultset>(this.reportUrl(parameter.name), { params })
      .pipe(map((response) => this.withAllOption(parameter, this.toSelectOptions(response))));
  }

  private loadSelectOptions(parameters: ReportParameter[]): Observable<ReportParameter[]> {
    const declared = new Set(parameters.map((parameter) => parameter.name));

    const requests = parameters.map((parameter) => {
      // A dependent parameter cannot be fetched until its parent has a value, so it is left to the
      // caller to load once the parent is chosen. A parameter naming a parent the report does not
      // actually declare is treated as independent — otherwise it could never become selectable,
      // and the report could never be run.
      const waitsForParent =
        parameter.parentParameterName !== null && declared.has(parameter.parentParameterName);
      if (parameter.displayType !== 'select' || waitsForParent) {
        return of(parameter);
      }

      const params = new HttpParams().set('parameterType', 'true');
      return this.http.get<GenericResultset>(this.reportUrl(parameter.name), { params }).pipe(
        map((response) => ({
          ...parameter,
          options: this.withAllOption(parameter, this.toSelectOptions(response)),
        })),
        // A tenant-specific lookup failure should affect only that field, not the entire form —
        // but it is recorded, so the field can say so rather than showing an empty list.
        catchError(() => of({ ...parameter, optionsFailed: true })),
      );
    });

    return requests.length > 0 ? forkJoin(requests) : of([]);
  }

  private toSelectOptions(response: GenericResultset): ReportSelectOption[] {
    return (response.data ?? []).map((entry) => this.toSelectOption(entry.row));
  }

  private withAllOption(
    parameter: ReportParameter,
    options: ReportSelectOption[],
  ): readonly ReportSelectOption[] {
    const alreadyOffersAll = options.some((option) => String(option.id) === String(ALL_OPTION.id));
    return offersAllOption(parameter) && !alreadyOffersAll ? [...options, ALL_OPTION] : options;
  }

  private toReportParameter(row: unknown): ReportParameter | null {
    if (!Array.isArray(row) || row.length < 9) {
      return null;
    }

    const [
      name,
      variable,
      label,
      displayType,
      formatType,
      defaultValue,
      selectOne,
      selectAll,
      parent,
    ] = row;
    if (
      typeof name !== 'string' ||
      typeof variable !== 'string' ||
      typeof displayType !== 'string'
    ) {
      return null;
    }

    return {
      name,
      variable,
      label: typeof label === 'string' && label ? label : variable,
      displayType: displayType.toLowerCase(),
      formatType: typeof formatType === 'string' ? formatType : '',
      defaultValue,
      selectOne,
      selectAll,
      parentParameterName: typeof parent === 'string' && parent ? parent : null,
      queryParameter: `R_${variable}`,
      options: [],
      optionsFailed: false,
    };
  }

  private toSelectOption(row: unknown): ReportSelectOption {
    if (!Array.isArray(row) || row.length < 2) {
      throw new Error('A report parameter lookup returned an invalid row.');
    }
    const [id, name] = row;
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof name !== 'string') {
      throw new TypeError('A report parameter lookup omitted a required field.');
    }
    return { id, name };
  }

  private buildRunParams(
    values: ReportParameterValues,
    exportCsv: boolean,
    outputType: 'CSV' | 'HTML',
  ): HttpParams {
    let params = new HttpParams()
      .set('exportCSV', String(exportCsv))
      .set('output-type', outputType);

    for (const [key, value] of Object.entries(values)) {
      params = params.set(key, String(value));
    }
    return params;
  }

  private reportUrl(reportName: string): string {
    const apiUrl = this.config.apiUrl.replace(/\/$/, '');
    return `${apiUrl}/runreports/${encodeURIComponent(reportName)}`;
  }
}
