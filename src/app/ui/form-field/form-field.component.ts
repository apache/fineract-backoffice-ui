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
  Component,
  ElementRef,
  afterNextRender,
  contentChild,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgModel } from '@angular/forms';
import { IonItem, IonNote } from '@ionic/angular/standalone';

import { TranslatePipe } from '../../core/adapters';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

/**
 * One labelled form control: the block every form in this application writes out by hand.
 *
 * ## The label actually labels the control
 *
 * The hand-written shape puts an `<ion-label position="stacked">` *beside* the control inside an
 * `<ion-item>`. In Ionic 8 that is decorative. `getLabelledById()` in `@ionic/core` reads the
 * control's own `label` property or its `label` slot, and nothing else — so a sibling
 * `ion-label` names nothing, and the accessible name came from an `[attr.aria-label]` repeated
 * on 633 controls. That works until someone deletes one as redundant, at which point the field
 * is silently unnamed (#287).
 *
 * This renders the label itself and then **moves that node into the control's `label` slot**
 * after the first render. Angular keeps owning the node, so the translation and the required
 * marker keep updating in place; Ionic sees a slotted label and the association is real. The
 * alternative — setting the control's `label` string property — cannot carry the marker as
 * markup, and would have put an asterisk inside the accessible name.
 *
 * ## What it does not take over
 *
 * The control stays the caller's: it is projected, not rendered here. 574 `[(ngModel)]`
 * bindings and the `name` that template-driven forms register by would all have had to change
 * shape otherwise, and `[disabled]="form.invalid"` on 92 submit buttons depends on that
 * registration. The wrapper reads the projected `NgModel` to decide when to show the error, and
 * touches nothing else about it.
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [IonItem, IonNote, TranslatePipe, TooltipDirective],
  template: `
    <div class="field">
      <ion-item fill="outline" [appTooltip]="hint() ? (hint() | appTranslate) : ''">
        <!--
          Rendered here so Angular owns its bindings, then relocated into the control's label
          slot after the first render. Hidden until then, so it cannot flash beside the control
          on first paint.
        -->
        <span #labelSlot class="field-label" [class.field-label-pending]="!relocated()">
          <span>{{ label() | appTranslate }}</span>
          @if (required()) {
            <span class="required-marker" aria-hidden="true">*</span>
          }
        </span>
        <ng-content></ng-content>
      </ion-item>
      @if (showError()) {
        <ion-note
          color="danger"
          class="field-error"
          role="alert"
          [attr.data-testid]="errorTestId()"
          >{{ errorKey() | appTranslate }}</ion-note
        >
      }
    </div>
  `,
  styles: [
    `
      .field {
        display: block;
      }
      .field-label-pending {
        visibility: hidden;
      }
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
      .field-error {
        display: block;
        padding-inline-start: 4px;
        margin-top: -4px;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class FormFieldComponent {
  /** Translation key for the label. Taken as a key, as `ColumnDef.label` already is. */
  readonly label = input.required<string>();
  readonly required = input(false);
  /** Translation key for the tooltip, if the field has one. */
  readonly hint = input('');
  /** Translation key for the message shown once the control is invalid and touched. */
  readonly errorKey = input('COMMON.REQUIRED');
  /** `data-testid` for the error note, so a spec can address it as it did before. */
  readonly errorTestId = input<string | null>(null);

  /**
   * Whether to show the error, decided by the caller.
   *
   * Deriving it here was tried and does not work. `contentChild(NgModel)` resolves, and the
   * control's `invalid` and `touched` are both true at the point the error should appear, but a
   * block conditioned on them never renders — measured by removing the bindings below and
   * watching the converted form's error cases fail, then restoring them and watching them pass.
   * The likely reason is that the only signal such a condition reads is the query itself, which
   * does not change when the control's plain getters do, so the wrapper's view is never
   * invalidated. That mechanism is a guess; the behaviour is not.
   *
   * So the caller passes the condition it already has in hand from its own template reference,
   * where it is known to re-evaluate:
   *
   *     <app-form-field [showError]="nameModel.invalid && nameModel.touched">
   *
   * One binding per field instead of ten lines of markup, and the error's shape, placement and
   * role stay here. Deriving it is worth returning to; it is not worth guessing at.
   */
  // `boolean | null` because that is what `AbstractControlDirective.invalid` and `.touched`
  // return, and every call site reads them straight off its own template reference. Narrowing
  // to `boolean` would put a `!!` at each one.
  readonly showError = input<boolean | null>(false);

  private readonly labelNode = viewChild.required<ElementRef<HTMLElement>>('labelSlot');
  private readonly projectedControl = contentChild(NgModel, { read: ElementRef });
  private readonly host = inject(ElementRef);

  // A signal, not a field: it is set from `afterNextRender`, after the view has been checked,
  // and a plain assignment there reports NG0100 rather than re-rendering.
  protected readonly relocated = signal(false);

  constructor() {
    afterNextRender(() => this.attachLabel());
  }

  /**
   * Moves the rendered label into the control's `label` slot.
   *
   * Ionic reads the slot when it renders its own label region, so the node has to be a child of
   * the control element rather than a sibling. `labelPlacement` is set here too: above the
   * control is what every form in this application already looks like.
   */
  private attachLabel(): void {
    const control = (this.projectedControl()?.nativeElement ??
      this.host.nativeElement.querySelector('ion-input, ion-select, ion-textarea')) as
      (HTMLElement & { labelPlacement?: string }) | null;
    const node = this.labelNode().nativeElement;
    if (!control || control.contains(node)) {
      return;
    }

    node.setAttribute('slot', 'label');
    control.append(node);
    control.labelPlacement = 'stacked';
    this.relocated.set(true);
  }
}
