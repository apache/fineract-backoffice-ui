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

import { Injectable } from '@angular/core';
// Type-only: `download.adapter.ts` names this class as the token's default binding.
import type { DownloadAdapter } from './download.adapter';

/** Fallback when sanitisation leaves nothing usable. */
const DEFAULT_FILENAME = 'download';

/**
 * Longest filename this will produce.
 *
 * 255 bytes is the limit on ext4, APFS and NTFS alike. Truncating here rather than letting
 * the browser do it means the extension survives, which is what decides whether the file
 * opens in anything when the user double-clicks it.
 */
const MAX_FILENAME_LENGTH = 200;

/**
 * {@link DownloadAdapter} implemented with an object URL and a synthetic anchor.
 *
 * This is the only file in the application permitted to call `URL.createObjectURL` or build a
 * download anchor; `eslint.config.js` enforces it.
 */
@Injectable({ providedIn: 'root' })
export class BrowserDownloadAdapter implements DownloadAdapter {
  save(content: Blob, filename: string): void {
    const url = URL.createObjectURL(content);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = this.sanitise(filename);
      // Firefox ignores `click()` on an anchor that is not in the document. Chrome and Safari
      // do not care, which is why half the call sites this replaces omitted it and worked.
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      // In `finally` so a throw between creating the URL and clicking still releases it. Every
      // hand-rolled version of this revoked on the success path only, and a back office left
      // open all day never gets that memory back.
      URL.revokeObjectURL(url);
    }
  }

  saveText(text: string, filename: string, mimeType = 'text/plain;charset=utf-8;'): void {
    this.save(new Blob([text], { type: mimeType }), filename);
  }

  /**
   * Reduces a filename to something safe to write to disk.
   *
   * Names reach this from Fineract, which stores whatever a user uploaded, so they are
   * attacker-influenced. Browsers already refuse to honour a path in `download`, but relying
   * on that leaves the guarantee with the browser; stripping separators and control characters
   * here makes it the application's.
   */
  private sanitise(filename: string): string {
    // Take the last path segment first, rather than rewriting separators into underscores.
    // Substituting would turn `../../etc/passwd` into `.._.._etc_passwd` — harmless, but it
    // preserves a path the user never asked to see in the name of their download. The
    // basename is both safer and what they expect.
    const basename = filename.split(/[/\\]/).filter(Boolean).pop() ?? '';

    const cleaned = basename
      // The characters Windows refuses in a filename, plus control characters. Spaces are
      // deliberately kept: `Client Statement 2026.pdf` is a perfectly good name.
      // eslint-disable-next-line no-control-regex -- control characters are exactly the target
      .replaceAll(/[:*?"<>|\u0000-\u001F]/g, '_')
      // A leading dot hides the file on Unix; a leading dash reads as a flag to shell tools.
      .replace(/^[.\-\s]+/, '')
      .trim();

    if (cleaned.length === 0) {
      return DEFAULT_FILENAME;
    }
    if (cleaned.length <= MAX_FILENAME_LENGTH) {
      return cleaned;
    }

    // Truncate the stem, keep the extension: a nameless `.csv` still opens in a spreadsheet,
    // whereas a correctly-named file with no extension opens in nothing.
    const lastDot = cleaned.lastIndexOf('.');
    if (lastDot <= 0 || cleaned.length - lastDot > 12) {
      return cleaned.slice(0, MAX_FILENAME_LENGTH);
    }
    const extension = cleaned.slice(lastDot);
    return cleaned.slice(0, MAX_FILENAME_LENGTH - extension.length) + extension;
  }
}
