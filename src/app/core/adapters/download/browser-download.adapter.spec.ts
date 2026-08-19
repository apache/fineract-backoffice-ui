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

import { TestBed } from '@angular/core/testing';
import { BrowserDownloadAdapter } from './browser-download.adapter';

/** Stand-in filename, repeated across the save-mechanics specs. */
const REPORT_CSV = 'report.csv';

describe('BrowserDownloadAdapter', () => {
  let adapter: BrowserDownloadAdapter;
  let anchor: HTMLAnchorElement;
  let click: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(BrowserDownloadAdapter);

    // A real anchor, with only the navigation suppressed: the specs assert on `download`,
    // which the browser itself normalises, so a plain object would test the wrong thing.
    anchor = document.createElement('a');
    click = spyOn(anchor, 'click');
    spyOn(document, 'createElement').and.returnValue(anchor);
  });

  it('clicks an anchor pointing at an object URL for the blob', () => {
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();

    adapter.save(new Blob(['x']), REPORT_CSV);

    expect(click).toHaveBeenCalled();
    expect(anchor.download).toBe(REPORT_CSV);
    expect(revoke).toHaveBeenCalled();
  });

  it('removes the anchor from the document again', () => {
    adapter.save(new Blob(['x']), REPORT_CSV);

    expect(anchor.isConnected).toBeFalse();
  });

  /*
   * The point of the `finally`: every hand-rolled version of this revoked on the success path
   * only, so a failure part-way through leaked the blob for the life of the document.
   */
  it('releases the object URL even when the click throws', () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    click.and.throwError('popup blocked');

    expect(() => adapter.save(new Blob(['x']), REPORT_CSV)).toThrow();
    expect(revoke).toHaveBeenCalled();
  });

  describe('filename sanitisation', () => {
    const savedNameFor = (filename: string) => {
      adapter.save(new Blob(['x']), filename);
      return anchor.download;
    };

    it('reduces a server-supplied path to its basename', () => {
      expect(savedNameFor('../../etc/passwd')).toBe('passwd');
      expect(savedNameFor(String.raw`C:\Windows\System32\drivers\etc\hosts`)).toBe('hosts');
    });

    it('keeps spaces, which are a legitimate part of a filename', () => {
      expect(savedNameFor('Client Statement 2026.pdf')).toBe('Client Statement 2026.pdf');
    });

    it('falls back when nothing usable survives', () => {
      expect(savedNameFor('///')).toBe('download');
    });

    it('keeps the extension when truncating an over-long name', () => {
      const name = `${'a'.repeat(400)}.csv`;

      const result = savedNameFor(name);

      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.csv')).toBeTrue();
    });
  });
});
