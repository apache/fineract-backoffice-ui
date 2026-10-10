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
 * Posts (or updates) the E2E summary comments for the pull request a completed E2E run
 * belongs to — including pull requests from forks.
 *
 * ## Why this is a separate workflow at all
 *
 * A `pull_request` run triggered from a fork gets a read-only `GITHUB_TOKEN`. That is
 * GitHub's design: the run executes the fork's code, so it must not hold a token that can
 * write to this repository. The consequence is that the E2E jobs cannot comment on exactly
 * the pull requests that most need the feedback — an outside contributor previously had to
 * open the run summary to see whether their change passed.
 *
 * `workflow_run` is the supported way out. It fires *after* the untrusted run finishes, and
 * the workflow that runs is the one on the **default branch**, with a token this repository
 * controls. The untrusted half produces a file; this half publishes it.
 *
 * ## What makes that safe, and what it does not
 *
 * The dangerous version of this pattern — "pwn request" — checks out or executes the pull
 * request's code while holding the writable token. This does neither. The calling workflow
 * checks out the base repository's default branch and runs only this file; the artifact is
 * read as data and never evaluated, interpolated into a shell, or passed through `${{ }}`.
 *
 * Two further rules, both load-bearing:
 *
 *   - **The pull request is resolved from the event, never from the artifact.** The artifact
 *     is written by a run of the contributor's own branch, so anything inside it is
 *     attacker-controlled — including, if it were trusted, which issue to comment on. The
 *     target is derived from `workflow_run.head_sha` and cross-checked against the head
 *     repository the event reports.
 *   - **The marker and title come from the allow-list below, not from the artifact.** The
 *     marker decides which existing comment gets overwritten. Taking it from the artifact
 *     would let a fork overwrite an arbitrary comment on its own pull request.
 *
 * The residual risk is inherent to commenting on fork pull requests at all: a contributor
 * can edit `scripts/e2e-summary.mjs` on their branch and make the summary say anything, and
 * that text is then posted under the Actions bot's name on their own pull request. Size is
 * capped and `@`-mentions are defused below so it cannot be turned into notification spam,
 * but the text itself is not trustworthy and the comment says so.
 */
const fs = require('node:fs');
const path = require('node:path');

/**
 * Artifacts this will publish, and the identity each one is published under.
 *
 * An allow-list rather than a pattern: artifact *names* are chosen by the untrusted run, so
 * an unrecognised one is ignored rather than posted. Keys must match the `name:` given to
 * `upload-artifact` in e2e.yml and ci.yml, *and* the directory each one is downloaded into by
 * pr-comments.yml — a body is bound to the marker it may post under by the directory it came
 * from, so those three lists agreeing is what makes a comment appear at all.
 * `scripts/pr-comment-actions.test.mjs` asserts the agreement, because pr-comments.yml cannot
 * be exercised on the pull request that changes it.
 */
const SUMMARIES_DIR = 'summaries';

const KNOWN_SUMMARIES = {
  'pr-comment-e2e-mocked': {
    marker: '<!-- e2e-report-mocked -->',
    title: 'E2E — mocked backend',
    artifact: 'playwright-report-mocked',
  },
  'pr-comment-e2e-backend': {
    marker: '<!-- e2e-report-backend -->',
    title: 'E2E — real Fineract',
    artifact: 'playwright-report-backend',
  },
  'pr-comment-diagram': {
    marker: '<!-- pr-sequence-diagram -->',
    title: 'What this change talks to',
    // No downloadable artifact: the diagram is the whole payload.
    artifact: null,
  },
};

/** Leaves room under GitHub's 65536-character comment limit for the wrapper below. */
const MAX_SUMMARY_CHARS = 60000;

/**
 * Defuses `@mentions` and issue cross-references in untrusted text.
 *
 * Without this a fork could make every summary mention a maintainer, or cross-link an
 * unrelated issue, and each posted comment would notify them. The characters are kept — the
 * text still reads correctly — but a zero-width space stops GitHub parsing them as a
 * reference.
 */
function defuseReferences(text) {
  return text.replace(/@(?=[A-Za-z0-9])/g, '@​').replace(/#(?=\d)/g, '#​');
}

/**
 * Describes what is actually under `summaries/`, for the log line when nothing was posted.
 *
 * The one-directory-per-artifact layout is an agreement with pr-comments.yml that no pull
 * request can test, because a `workflow_run` workflow only ever runs the copy on the default
 * branch. When it breaks, three "skipping" lines and a green check are the only trace — which
 * is how a dropped diagram comment went unnoticed for six weeks. A `.md` sitting at the root
 * instead of inside an artifact directory is that break, and is named here explicitly.
 */
function describeSummariesDir() {
  let entries;
  try {
    entries = fs.readdirSync(SUMMARIES_DIR, { withFileTypes: true });
  } catch {
    return `${SUMMARIES_DIR}/ does not exist: no artifact was downloaded.`;
  }
  if (!entries.length) return `${SUMMARIES_DIR}/ is empty.`;

  const strays = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
  const found = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
  const description = `${SUMMARIES_DIR}/ contains: ${found.join(', ')}.`;
  if (!strays.length) return description;

  return (
    `${description} A .md at the root rather than inside an artifact directory means ` +
    'download-artifact extracted without one — it does that whenever a run produced exactly ' +
    'one match. Give each artifact its own named download step in pr-comments.yml.'
  );
}

/** Reads whichever `.md` file the artifact contained, or null when there is none. */
function readSummary(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const file = entries.find((name) => name.endsWith('.md'));
  if (!file) return null;
  try {
    return fs.readFileSync(path.join(dir, file), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Finds the pull request this run belongs to, from the event alone.
 *
 * `workflow_run.pull_requests` is empty for forks, which is precisely the case that matters,
 * so it is not used. The head SHA is; it comes from the event payload and a contributor
 * cannot forge it into pointing at someone else's branch.
 */
async function resolvePullRequest({ github, context, run }) {
  const { owner, repo } = context.repo;

  const byCommit = await github.rest.repos
    .listPullRequestsAssociatedWithCommit({ owner, repo, commit_sha: run.head_sha })
    .then((response) => response.data)
    .catch(() => []);

  const headRepo = run.head_repository?.full_name;
  const match = byCommit.find(
    (pr) => pr.head.sha === run.head_sha && (!headRepo || pr.head.repo?.full_name === headRepo),
  );
  if (match) return match;

  // Fallback for the case where the commit-association index has not caught up: ask for open
  // pull requests from this head branch, then re-check the SHA rather than trusting the name.
  if (!headRepo || !run.head_branch) return null;
  const [headOwner] = headRepo.split('/');
  const byBranch = await github.rest.pulls
    .list({ owner, repo, state: 'open', head: `${headOwner}:${run.head_branch}` })
    .then((response) => response.data)
    .catch(() => []);

  return byBranch.find((pr) => pr.head.sha === run.head_sha) ?? null;
}

async function upsert({ github, context, issueNumber, marker, body }) {
  const { owner, repo } = context.repo;
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (comment) => comment.user?.type === 'Bot' && comment.body?.includes(marker),
  );

  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    return 'updated';
  }
  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  return 'created';
}

const publish = async ({ github, context, core }) => {
  const run = context.payload.workflow_run;
  const log = core?.info ?? console.log;

  const pull = await resolvePullRequest({ github, context, run });
  if (!pull) {
    // Not an error: a push to a branch with no open pull request reaches here routinely.
    log(`No open pull request for ${run.head_sha}; nothing to comment on.`);
    return;
  }

  const runUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${run.id}`;
  const isFork = run.head_repository?.full_name !== `${context.repo.owner}/${context.repo.repo}`;

  let posted = 0;
  for (const [name, config] of Object.entries(KNOWN_SUMMARIES)) {
    const raw = readSummary(path.join(SUMMARIES_DIR, name));
    if (raw === null) {
      log(`No summary in ${name}; skipping.`);
      continue;
    }

    let summary = defuseReferences(raw);
    if (summary.length > MAX_SUMMARY_CHARS) {
      summary = `${summary.slice(0, MAX_SUMMARY_CHARS)}\n\n_Summary truncated at ${MAX_SUMMARY_CHARS} characters._`;
    }

    // A summary that already opens with its own marker and heading — the diagram does —
    // is posted as-is; doubling the heading would read as a rendering bug.
    const carriesOwnHeading = raw.trimStart().startsWith(config.marker);
    const body = [
      config.marker,
      ...(carriesOwnHeading ? [] : [`### ${config.title}`]),
      carriesOwnHeading ? summary.replace(config.marker, '').trimStart() : summary,
      '',
      ...(config.artifact
        ? [
            `📼 [Download the HTML report, videos and traces](${runUrl}) — see the \`${config.artifact}\` artifact.`,
          ]
        : []),
      // Stated on every comment, not only fork ones: a reader should not have to know which
      // kind of pull request they are looking at to know how much to trust the text.
      '',
      `<sub>Generated by [run ${run.id}](${runUrl}) from \`${run.head_sha.slice(0, 7)}\`.` +
        (isFork ? ' The run executed a fork branch, so treat its contents as unverified.' : '') +
        '</sub>',
    ].join('\n');

    const action = await upsert({
      github,
      context,
      issueNumber: pull.number,
      marker: config.marker,
      body,
    });
    log(`${action} the ${config.title} comment on #${pull.number}.`);
    posted += 1;
  }

  if (!posted) {
    log(`No recognised summary artifacts were present. ${describeSummariesDir()}`);
  }
};

module.exports = publish;

// Exported for the unit tests; not used by the workflow.
module.exports.KNOWN_SUMMARIES = KNOWN_SUMMARIES;
module.exports.SUMMARIES_DIR = SUMMARIES_DIR;
module.exports.defuseReferences = defuseReferences;
module.exports.describeSummariesDir = describeSummariesDir;
module.exports.readSummary = readSummary;
