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

/**
 * The three comment actions that react to a fork's pull request holding a writable token.
 *
 *   node --test "scripts/*.test.mjs"
 *
 * Two are `pull_request_target` (signatures, welcome) and one is `workflow_run` (the E2E
 * summaries and the change diagram). The properties worth pinning are the ones that keep
 * them safe and quiet: exactly one comment per pull request however many times it is pushed,
 * the comment removed again once the problem is fixed, and no attacker-controlled text turned
 * into a live `@mention`.
 *
 * None of them can be exercised on the pull request that changes it — both trigger types run
 * the copy of the workflow on the base branch — so these tests are the only pre-merge check
 * that the logic is right. The publisher's tests go further and pin its *agreement with the
 * workflow files*, because getting that wrong is what silently dropped the change-diagram
 * comment from every pull request for six weeks.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import checkSignatures from '../.github/scripts/check-commit-signatures.js';
import publishSummaries from '../.github/scripts/post-e2e-comments.js';
import welcome from '../.github/scripts/welcome-contributor.js';

const { buildBody, groupByReason, defuseReferences, MARKER } = checkSignatures;

/** A commit as `pulls.listCommits` returns it. */
function commit(sha, { verified = false, reason = 'no_user', message = 'chore: a change' } = {}) {
  return { sha, commit: { message, verification: { verified, reason } } };
}

/**
 * Records what the script asked the API to do, so a test can assert on the calls rather than
 * on a rendered string.
 */
function fakeGithub({ comments = [], commits = [] } = {}) {
  const calls = { created: [], updated: [], deleted: [] };
  const github = {
    paginate: async (fn) => fn(),
    rest: {
      issues: {
        listComments: async () => comments,
        createComment: async (args) => calls.created.push(args),
        updateComment: async (args) => calls.updated.push(args),
        deleteComment: async (args) => calls.deleted.push(args),
      },
      pulls: { listCommits: async () => commits },
    },
  };
  return { github, calls };
}

function fakeCore() {
  const state = { failed: null, errors: [] };
  return {
    state,
    core: {
      info: () => {},
      error: (message) => state.errors.push(message),
      setFailed: (message) => {
        state.failed = message;
      },
    },
  };
}

const context = { repo: { owner: 'apache', repo: 'fineract-backoffice-ui' } };
const pullEvent = (pull) => ({ ...context, payload: { pull_request: pull } });

/* ---------------------------------------------------------------- signatures */

test('a fully verified pull request fails nothing and posts no comment', async () => {
  const { github, calls } = fakeGithub({
    commits: [commit('aaaaaaaa', { verified: true, reason: 'valid' })],
  });
  const { core, state } = fakeCore();

  await checkSignatures({ github, context: pullEvent({ number: 7 }), core });

  assert.equal(state.failed, null);
  assert.equal(calls.created.length, 0);
});

test('an unverified commit fails the check and comments once', async () => {
  const { github, calls } = fakeGithub({ commits: [commit('deadbeef')] });
  const { core, state } = fakeCore();

  await checkSignatures({ github, context: pullEvent({ number: 7 }), core });

  assert.match(state.failed, /1 of 1 commit/);
  assert.equal(calls.created.length, 1);
  assert.ok(calls.created[0].body.includes(MARKER));
  assert.ok(calls.created[0].body.includes('deadbee'));
});

test('a re-run updates the existing comment instead of adding a second', async () => {
  const existing = { id: 99, user: { type: 'Bot' }, body: `${MARKER}\nstale` };
  const { github, calls } = fakeGithub({ comments: [existing], commits: [commit('deadbeef')] });
  const { core } = fakeCore();

  await checkSignatures({ github, context: pullEvent({ number: 7 }), core });

  assert.equal(calls.created.length, 0);
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].comment_id, 99);
});

test('fixing the signatures removes the comment the failure left behind', async () => {
  const existing = { id: 99, user: { type: 'Bot' }, body: `${MARKER}\nold failure` };
  const { github, calls } = fakeGithub({
    comments: [existing],
    commits: [commit('aaaaaaaa', { verified: true, reason: 'valid' })],
  });
  const { core, state } = fakeCore();

  await checkSignatures({ github, context: pullEvent({ number: 7 }), core });

  assert.equal(state.failed, null);
  assert.equal(calls.deleted.length, 1);
  assert.equal(calls.deleted[0].comment_id, 99);
});

test('a human comment quoting the marker is never overwritten', async () => {
  const human = { id: 5, user: { type: 'User' }, body: `I saw ${MARKER} in the logs` };
  const { github, calls } = fakeGithub({ comments: [human], commits: [commit('deadbeef')] });
  const { core } = fakeCore();

  await checkSignatures({ github, context: pullEvent({ number: 7 }), core });

  assert.equal(calls.updated.length, 0);
  assert.equal(calls.created.length, 1);
});

test('each reason is explained once, with its own remedy', () => {
  const groups = groupByReason([
    commit('a1', { reason: 'no_user' }),
    commit('a2', { reason: 'no_user' }),
    commit('b1', { reason: 'unsigned' }),
  ]);
  assert.deepEqual([...groups.keys()], ['no_user', 'unsigned']);
  assert.equal(groups.get('no_user').length, 2);
});

test('no_user is explained as an identity problem, not a signing one', () => {
  const body = buildBody({ unverified: [commit('a1', { reason: 'no_user' })], total: 1 });
  assert.match(body, /user\.email/);
  assert.match(body, /not a signing one/);
});

test('an unrecognised reason still produces a usable comment', () => {
  const body = buildBody({ unverified: [commit('a1', { reason: 'something_new' })], total: 1 });
  assert.match(body, /something_new/);
  assert.match(body, /CONTRIBUTING/);
});

test('a commit subject cannot mention anyone from the comment', () => {
  const body = buildBody({
    unverified: [commit('a1', { reason: 'unsigned', message: 'fix @maintainer per #1234' })],
    total: 1,
  });
  assert.ok(!/@maintainer/.test(body), 'mention should be defused');
  assert.ok(!/#1234/.test(body), 'issue reference should be defused');
});

test('an overlong commit subject is truncated', () => {
  const body = buildBody({
    unverified: [commit('a1', { reason: 'unsigned', message: 'x'.repeat(200) })],
    total: 1,
  });
  assert.ok(body.includes('…'));
  assert.ok(!body.includes('x'.repeat(100)));
});

test('defuseReferences keeps the text readable', () => {
  assert.equal(defuseReferences('@user').normalize('NFKD').replace(/​/g, ''), '@user');
});

/**
 * Regression: the body was assembled with `.filter(Boolean)`, which silently dropped every
 * intentional `''` separator along with the optional truncation notice. The Markdown still
 * "worked" as a string and every assertion above still passed — it just rendered with the
 * headings welded to the paragraph above them. Only reading the posted output showed it.
 */
test('every heading is preceded by a blank line', () => {
  const body = buildBody({
    unverified: [commit('a1', { reason: 'no_user' }), commit('b1', { reason: 'unsigned' })],
    total: 2,
  });
  const lines = body.split('\n');
  let inFence = false;
  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      inFence = !inFence;
      return;
    }
    // `#` inside a fence is a shell comment, not a heading.
    if (inFence || i === 0 || !line.startsWith('#')) return;
    assert.equal(lines[i - 1], '', `heading "${line}" must have a blank line before it`);
  });
});

/* ------------------------------------------------------------------ welcome */

test('a first-time contributor is greeted', async () => {
  const { github, calls } = fakeGithub();
  const { core } = fakeCore();

  await welcome({
    github,
    context: pullEvent({
      number: 3,
      author_association: 'FIRST_TIME_CONTRIBUTOR',
      user: { login: 'newcomer', type: 'User' },
    }),
    core,
  });

  assert.equal(calls.created.length, 1);
  const body = calls.created[0].body;
  assert.ok(body.includes(welcome.MARKER));
  assert.match(body, /Code of Conduct/);
  assert.match(body, /dev@fineract\.apache\.org/);
  assert.match(body, /matrix\.to/);
  assert.match(body, /Verified/);
});

test('the greeting renders as Markdown, with every heading separated', () => {
  const lines = welcome.buildBody('newcomer').split('\n');
  let inFence = false;
  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence || i === 0 || !line.startsWith('#')) return;
    assert.equal(lines[i - 1], '', `heading "${line}" must have a blank line before it`);
  });
});

test('every link in the greeting is an absolute URL', () => {
  const body = welcome.buildBody('newcomer');
  for (const [, url] of body.matchAll(/\]\(([^)]+)\)/g)) {
    assert.match(url, /^https:\/\//, `"${url}" must be absolute — the comment has no repo context`);
  }
});

test('a returning contributor is not greeted again', async () => {
  const { github, calls } = fakeGithub();
  const { core } = fakeCore();

  await welcome({
    github,
    context: pullEvent({
      number: 3,
      author_association: 'CONTRIBUTOR',
      user: { login: 'regular', type: 'User' },
    }),
    core,
  });

  assert.equal(calls.created.length, 0);
});

test('a bot is not greeted', async () => {
  const { github, calls } = fakeGithub();
  const { core } = fakeCore();

  await welcome({
    github,
    context: pullEvent({
      number: 3,
      author_association: 'FIRST_TIME_CONTRIBUTOR',
      user: { login: 'dependabot[bot]', type: 'Bot' },
    }),
    core,
  });

  assert.equal(calls.created.length, 0);
});

test('reopening a pull request does not stack up greetings', async () => {
  const existing = { id: 12, user: { type: 'Bot' }, body: `${welcome.MARKER}\nhello` };
  const { github, calls } = fakeGithub({ comments: [existing] });
  const { core } = fakeCore();

  await welcome({
    github,
    context: pullEvent({
      number: 3,
      author_association: 'FIRST_TIME_CONTRIBUTOR',
      user: { login: 'newcomer', type: 'User' },
    }),
    core,
  });

  assert.equal(calls.created.length, 0);
});

/* ------------------------------------------------- the summary/diagram publisher */

const { KNOWN_SUMMARIES, SUMMARIES_DIR } = publishSummaries;

const DIAGRAM_MARKER = KNOWN_SUMMARIES['pr-comment-diagram'].marker;

/** A diagram body as `scripts/pr-sequence-diagram.mjs` renders it: marker, heading, fence. */
const DIAGRAM = [
  DIAGRAM_MARKER,
  '### 🔄 What this change talks to',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  autonumber',
  '  participant LoanViewComponent as LoanViewComponent (Component)',
  '  LoanViewComponent->>LoanService: getLoansLoanId()',
  '```',
  '',
].join('\n');

const THIS_REPO = `${context.repo.owner}/${context.repo.repo}`;
const HEAD_SHA = 'c0ffee1c0ffee1c0ffee1c0ffee1c0ffee1c0ffe';

/**
 * A `workflow_run` completion for an open pull request in this repository.
 *
 * `head_repository` matching the base repository is the non-fork case; `resolvePullRequest`
 * cross-checks it against the pull request it found, so it has to be consistent.
 */
const runEvent = () => ({
  ...context,
  payload: {
    workflow_run: {
      id: 4242,
      head_sha: HEAD_SHA,
      head_branch: 'topic',
      head_repository: { full_name: THIS_REPO },
    },
  },
});

function fakeRunGithub({ comments = [] } = {}) {
  const calls = { created: [], updated: [] };
  const pulls = [{ number: 695, head: { sha: HEAD_SHA, repo: { full_name: THIS_REPO } } }];
  const github = {
    paginate: async (fn) => fn(),
    rest: {
      repos: { listPullRequestsAssociatedWithCommit: async () => ({ data: pulls }) },
      pulls: { list: async () => ({ data: pulls }) },
      issues: {
        listComments: async () => comments,
        createComment: async (args) => calls.created.push(args),
        updateComment: async (args) => calls.updated.push(args),
      },
    },
  };
  return { github, calls };
}

function fakeLog() {
  const lines = [];
  return { lines, core: { info: (message) => lines.push(message) } };
}

/**
 * Runs the publisher against a throwaway workspace laid out exactly as the download step
 * left it, because the paths it reads are relative to the working directory.
 */
async function publishWith(layout, { comments = [] } = {}) {
  const workspace = mkdtempSync(path.join(tmpdir(), 'pr-comment-'));
  for (const [file, contents] of Object.entries(layout)) {
    const target = path.join(workspace, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  const { github, calls } = fakeRunGithub({ comments });
  const { lines, core } = fakeLog();
  const cwd = process.cwd();
  try {
    process.chdir(workspace);
    await publishSummaries({ github, context: runEvent(), core });
  } finally {
    process.chdir(cwd);
    rmSync(workspace, { recursive: true, force: true });
  }
  return { calls, lines };
}

test('a diagram in its own artifact directory is posted under the allow-listed marker', async () => {
  const { calls } = await publishWith({
    [`${SUMMARIES_DIR}/pr-comment-diagram/pr-diagram.md`]: DIAGRAM,
  });

  assert.equal(calls.created.length, 1);
  const body = calls.created[0].body;
  assert.equal(calls.created[0].issue_number, 695);
  assert.ok(
    body.startsWith(DIAGRAM_MARKER),
    'the marker has to lead, or the upsert cannot find it',
  );
  assert.ok(body.includes('```mermaid'), 'the fence is the whole point of the comment');
  assert.ok(body.includes('sequenceDiagram'));
  // The body carries its own heading, so the publisher must not add a second one.
  assert.equal(body.match(/What this change talks to/g).length, 1);
});

test('the fence survives the publisher untouched, so GitHub can render it', async () => {
  const { calls } = await publishWith({
    [`${SUMMARIES_DIR}/pr-comment-diagram/pr-diagram.md`]: DIAGRAM,
  });

  const fence = /```mermaid\n([\s\S]*?)\n```/.exec(calls.created[0].body);
  assert.ok(fence, 'a mangled fence renders as a code block rather than a chart');
  assert.equal(fence[1].split('\n')[0], 'sequenceDiagram');
  assert.ok(
    !/[​]/.test(fence[1]),
    'defuseReferences must not inject a zero-width space into Mermaid source',
  );
});

test('a single-match download that collapsed the layout is reported, not shrugged off', async () => {
  // What download-artifact actually produces for a run with one `pr-comment-*` artifact:
  // `artifacts.length === 1` extracts straight into `path`, with no directory for the
  // artifact. The directory is how a body is bound to its marker, so the comment cannot be
  // posted -- but the log has to say why, because nothing else will.
  const { calls, lines } = await publishWith({
    [`${SUMMARIES_DIR}/pr-diagram.md`]: DIAGRAM,
  });

  assert.equal(calls.created.length, 0);
  const complaint = lines.find((line) => line.includes('No recognised summary artifacts'));
  assert.ok(complaint, 'the publisher went quiet about posting nothing');
  assert.ok(complaint.includes('pr-diagram.md'), 'the log should name the file it found');
  assert.ok(complaint.includes('exactly one match'), 'the log should name the cause');
});

test('an artifact name outside the allow-list is ignored', async () => {
  const { calls } = await publishWith({
    [`${SUMMARIES_DIR}/pr-comment-impostor/pr-diagram.md`]: DIAGRAM,
  });

  assert.equal(calls.created.length, 0);
});

test('a re-run updates the diagram comment instead of stacking another', async () => {
  const existing = { id: 77, user: { type: 'Bot' }, body: `${DIAGRAM_MARKER}\nan older diagram` };
  const { calls } = await publishWith(
    { [`${SUMMARIES_DIR}/pr-comment-diagram/pr-diagram.md`]: DIAGRAM },
    { comments: [existing] },
  );

  assert.equal(calls.created.length, 0);
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].comment_id, 77);
});

test('a mention inside a summary is defused before it is published', async () => {
  const { calls } = await publishWith({
    [`${SUMMARIES_DIR}/pr-comment-e2e-mocked/e2e-summary.md`]: 'Ping @maintainer about #1234.',
  });

  assert.equal(calls.created.length, 1);
  assert.ok(!calls.created[0].body.includes('@maintainer'));
  assert.ok(calls.created[0].body.includes('@​maintainer'));
  assert.ok(calls.created[0].body.includes('#​1234'));
});

/**
 * The allow-list, the uploads and the downloads have to name the same artifacts.
 *
 * This is the check that would have caught the dropped diagram comment. A `workflow_run`
 * workflow runs the copy on the default branch, so pr-comments.yml is never exercised by the
 * pull request that edits it, and a disagreement between these three lists shows up only as a
 * comment that never appears -- on a green pull request.
 */
test('every uploaded comment artifact is downloaded into its own allow-listed directory', () => {
  const read = (file) =>
    readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');

  const uploaded = new Set();
  for (const file of ['ci.yml', 'e2e.yml']) {
    for (const match of read(file).matchAll(/^\s*name:\s*(pr-comment-[\w-]+)\s*$/gm)) {
      uploaded.add(match[1]);
    }
  }

  const downloaded = new Map();
  for (const match of read('pr-comments.yml').matchAll(
    /^\s*name:\s*(pr-comment-[\w-]+)\s*\n\s*path:\s*(\S+)\s*$/gm,
  )) {
    downloaded.set(match[1], match[2]);
  }

  const allowed = Object.keys(KNOWN_SUMMARIES).sort();
  assert.deepEqual([...uploaded].sort(), allowed, 'an upload has no entry in the allow-list');
  assert.deepEqual(
    [...downloaded.keys()].sort(),
    allowed,
    'an allow-listed artifact is not downloaded',
  );

  for (const [name, into] of downloaded) {
    // Not `summaries` and not a pattern download: the directory per artifact is what binds a
    // body to the marker it may post under.
    assert.equal(
      into,
      `${SUMMARIES_DIR}/${name}`,
      `${name} is downloaded into the wrong directory`,
    );
  }
});
