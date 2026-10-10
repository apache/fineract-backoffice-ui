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

import {
  effect,
  inject,
  input,
  output,
  signal,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonItem, IonLabel, IonInput, IonList, IonSpinner } from '@ionic/angular/standalone';
import { debounceTime, distinctUntilChanged, switchMap, startWith } from 'rxjs/operators';
import { ClientService, GetClientsResponse } from '../../../api';
import { TranslatePipe } from '../../../core/adapters';

/**
 * Reusable client search component with autocomplete.
 *
 * Allows users to search for clients by name and select one.
 * Emits the selected client's ID.
 */
@Component({
  selector: 'app-client-search',
  standalone: true,
  imports: [ReactiveFormsModule, IonItem, IonLabel, IonInput, IonList, IonSpinner, TranslatePipe],
  template: `
    <div class="client-search-wrapper">
      <ion-item fill="outline">
        <ion-label position="stacked">{{ label() | appTranslate }}</ion-label>
        <ion-input
          [attr.aria-label]="label() | appTranslate"
          type="text"
          [formControl]="searchControl"
          [placeholder]="'COMMON.SEARCH_PLACEHOLDER' | appTranslate"
          [required]="required()"
          id="client-search-input"
          data-testid="client-search-input"
          (ionInput)="onInputChange($event)"
        ></ion-input>
        @if (isLoading()) {
          <ion-spinner name="crescent" slot="end"></ion-spinner>
        }
      </ion-item>

      @if (showDropdown() && filteredClients().length > 0) {
        <ion-list
          class="autocomplete-list"
          id="client-search-results"
          data-testid="client-search-results"
        >
          @for (client of filteredClients(); track client['id']) {
            <ion-item
              button
              (click)="onSelected(client)"
              class="autocomplete-item"
              [id]="'client-search-item-' + client['id']"
              [attr.data-testid]="'client-search-item-' + client['id']"
            >
              <ion-label>
                <h2>{{ client['displayName'] }}</h2>
                <p>#{{ client['accountNo'] }}</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }

      @if (showDropdown() && !isLoading() && searchInputVal() && filteredClients().length === 0) {
        <ion-list class="autocomplete-list">
          <ion-item class="autocomplete-item">
            <ion-label color="medium">{{ 'COMMON.NO_DATA' | appTranslate }}</ion-label>
          </ion-item>
        </ion-list>
      }
    </div>
  `,
  styles: [
    `
      .client-search-wrapper {
        position: relative;
        width: 100%;
      }
      .autocomplete-list {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--ion-color-light-shade, #e0e0e0);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-radius: 4px;
        background: var(--ion-background-color, #ffffff);
      }
      .autocomplete-item {
        --padding-start: 16px;
        --inner-padding-end: 16px;
      }
    `,
  ],
})
export class ClientSearchComponent implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input('COMMON.CLIENT');
  readonly required = input(false);
  readonly initialClientId = input<number | null>(null);

  readonly clientSelected = output<number>();

  searchControl = new FormControl<string | Record<string, unknown>>('');
  readonly searchInputVal = signal('');
  readonly showDropdown = signal(false);
  readonly filteredClients = signal<Record<string, unknown>[]>([]);
  readonly isLoading = signal(false);

  constructor() {
    // Replaces `ngOnChanges`, which does not run for signal inputs. The effect covers both the
    // initial value and every later change, so the one-shot `loadInitialClient()` that used to
    // sit at the end of `ngOnInit` is gone too.
    effect(() => this.loadInitialClient(this.initialClientId()));
  }

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((val) => {
          const valueStr = typeof val === 'string' ? val : '';
          this.searchInputVal.set(valueStr);
          if (!valueStr) {
            this.showDropdown.set(false);
            return [];
          }
          this.isLoading.set(true);
          this.showDropdown.set(true);
          const searchTerm = valueStr.length > 0 ? valueStr + '%' : undefined;
          return this.clientService.getClients(
            undefined,
            undefined,
            searchTerm,
            undefined,
            undefined,
            undefined,
            undefined,
            0,
            20,
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response: GetClientsResponse) => {
          this.filteredClients.set(
            (Array.from(response.pageItems || []) as Record<string, unknown>[]) || [],
          );
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.filteredClients.set([]);
        },
      });
  }

  onInputChange(event: CustomEvent): void {
    const val = (event.detail.value as string) || '';
    this.searchControl.setValue(val);
  }

  private loadInitialClient(clientId: number | null): void {
    if (!clientId) return;

    this.clientService
      .getClientsClientId(clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((client) => {
        const clientObj = client as Record<string, unknown>;
        const displayName = (clientObj['displayName'] as string) || '';
        this.searchControl.setValue(displayName, { emitEvent: false });
      });
  }

  displayFn(client: Record<string, unknown> | string | null): string {
    if (typeof client === 'string') {
      return client;
    }
    return client && client['displayName'] ? (client['displayName'] as string) : '';
  }

  onSelected(client: Record<string, unknown> | null): void {
    if (client && client['id']) {
      const displayName = (client['displayName'] as string) || '';
      this.searchControl.setValue(displayName, { emitEvent: false });
      this.showDropdown.set(false);
      this.clientSelected.emit(client['id'] as number);
    }
  }
}
