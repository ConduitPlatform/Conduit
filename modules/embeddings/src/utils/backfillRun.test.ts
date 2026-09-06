import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Query } from '@conduitplatform/grpc-sdk';
import type { BackfillRun } from '../models/BackfillRun.schema.js';
import {
  applyAtomicBackfillCountDelta,
  applyBackfillJobCounts,
  applyBackfillPage,
  BACKFILL_RUN_STATES,
  backfillCountIncrementPatch,
  boundBackfillBatchSize,
  boundBackfillPage,
  buildBackfillPageQuery,
  canCancelBackfill,
  cancelBackfillRun,
  completeBackfillRun,
  createQueuedBackfill,
  DEFAULT_BACKFILL_BATCH_SIZE,
  failBackfillRun,
  isLegalBackfillTransition,
  isResumeEligible,
  isSafeBackfillFilter,
  LEGAL_BACKFILL_TRANSITIONS,
  MAX_BACKFILL_BATCH_SIZE,
  MAX_BACKFILL_ERROR_LENGTH,
  MAX_BACKFILL_FILTER_BYTES,
  MAX_BACKFILL_FILTER_IN_VALUES,
  MIN_BACKFILL_BATCH_SIZE,
  resumeBackfillRun,
  sanitizeBackfillError,
  startBackfillRun,
  toBackfillCountUpdateQuery,
} from './backfillRun.js';

const now = new Date('2026-09-06T16:00:00.000Z');

function queuedRun() {
  const created = createQueuedBackfill({
    schemaName: 'Article',
    configId: 'cfg1',
    batchSize: 2,
    onlyMissing: true,
    filter: { published: true },
  });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error('expected queued run');
  return created.run;
}

function runningRun() {
  const started = startBackfillRun(queuedRun(), now);
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error('expected running run');
  return started.run;
}

describe('backfill run state transitions', () => {
  it('allows only the documented legal transitions', () => {
    assert.deepEqual(BACKFILL_RUN_STATES, [
      'queued',
      'running',
      'completed',
      'failed',
      'canceled',
    ]);
    assert.equal(isLegalBackfillTransition('queued', 'running'), true);
    assert.equal(isLegalBackfillTransition('queued', 'canceled'), true);
    assert.equal(isLegalBackfillTransition('running', 'completed'), true);
    assert.equal(isLegalBackfillTransition('running', 'failed'), true);
    assert.equal(isLegalBackfillTransition('running', 'canceled'), true);
    assert.equal(isLegalBackfillTransition('failed', 'queued'), true);
    assert.equal(isLegalBackfillTransition('canceled', 'queued'), true);
    assert.equal(isLegalBackfillTransition('queued', 'failed'), true);
    assert.equal(isLegalBackfillTransition('queued', 'completed'), false);
    assert.equal(isLegalBackfillTransition('running', 'queued'), false);
    assert.equal(isLegalBackfillTransition('completed', 'queued'), false);
    assert.equal(isLegalBackfillTransition('completed', 'running'), false);
    assert.equal(isLegalBackfillTransition('failed', 'running'), false);
    assert.equal(isLegalBackfillTransition('canceled', 'running'), false);
    assert.deepEqual(LEGAL_BACKFILL_TRANSITIONS.completed, []);
  });

  it('starts a queued run and records startedAt', () => {
    const started = startBackfillRun(queuedRun(), now);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    assert.equal(started.run.state, 'running');
    assert.equal(started.run.startedAt?.toISOString(), now.toISOString());
    assert.equal(started.run.finishedAt, null);
    assert.equal(started.run.error, null);
  });

  it('rejects illegal transitions without mutating counters', () => {
    const completed = completeBackfillRun(runningRun(), now);
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    const resumed = resumeBackfillRun(completed.run);
    assert.equal(resumed.ok, false);
    if (resumed.ok) return;
    assert.equal(resumed.reason, 'illegal_transition');
    const failedFromCompleted = failBackfillRun(completed.run, 'boom', now);
    assert.equal(failedFromCompleted.ok, false);
  });
});

describe('backfill pagination and cursor progression', () => {
  it('advances the cursor through ordered pages and marks exhaustion', () => {
    const first = applyBackfillPage(runningRun(), [{ _id: 'a' }, { _id: 'b' }]);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.exhausted, false);
    assert.equal(first.run.cursor, 'b');
    assert.equal(first.run.scannedCount, 2);
    assert.equal(first.run.queuedCount, 2);

    const query = buildBackfillPageQuery(first.run, 'embedding');
    assert.equal(query.ok, true);
    if (!query.ok) return;
    assert.deepEqual(query.page, {
      query: { published: true, embedding: null, _id: { $gt: 'b' } },
      sort: { _id: 1 },
      limit: 2,
    });

    const last = applyBackfillPage(first.run, [{ _id: 'c' }]);
    assert.equal(last.ok, true);
    if (!last.ok) return;
    assert.equal(last.exhausted, true);
    assert.equal(last.run.cursor, 'c');
    assert.equal(last.run.scannedCount, 3);
  });

  it('does not move the cursor on an empty exhausted page', () => {
    const empty = applyBackfillPage(runningRun(), []);
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    assert.equal(empty.exhausted, true);
    assert.equal(empty.run.cursor, null);
    assert.equal(empty.run.scannedCount, 0);
    const completed = completeBackfillRun(empty.run, now);
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    assert.equal(completed.run.state, 'completed');
  });

  it('rejects a page that would not advance the cursor', () => {
    const first = applyBackfillPage(runningRun(), [{ _id: 'a' }, { _id: 'b' }]);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const stuck = applyBackfillPage(first.run, [{ _id: 'b' }]);
    assert.equal(stuck.ok, false);
    if (stuck.ok) return;
    assert.equal(stuck.reason, 'cursor');
  });

  it('owns pagination _id and requires a target field for onlyMissing', () => {
    const run = runningRun();
    const missingTarget = buildBackfillPageQuery(run);
    assert.equal(missingTarget.ok, false);
    const ownedId = buildBackfillPageQuery(
      { ...run, cursor: 'doc1', filter: { _id: 'ignored', published: true } },
      'embedding',
    );
    assert.equal(ownedId.ok, true);
    if (!ownedId.ok) return;
    assert.deepEqual(ownedId.page.query._id, { $gt: 'doc1' });
    assert.equal(ownedId.page.query.published, true);
  });
});

describe('backfill counters', () => {
  it('tracks scanned, queued, processed, and failed counts', () => {
    const paged = applyBackfillPage(runningRun(), [{ _id: 'a' }, { _id: 'b' }], 2);
    assert.equal(paged.ok, true);
    if (!paged.ok) return;
    const progressed = applyBackfillJobCounts(paged.run, { processed: 1, failed: 1 });
    assert.equal(progressed.ok, true);
    if (!progressed.ok) return;
    assert.equal(progressed.run.scannedCount, 2);
    assert.equal(progressed.run.queuedCount, 2);
    assert.equal(progressed.run.processedCount, 1);
    assert.equal(progressed.run.failedCount, 1);
  });

  it('rejects job counts that exceed queued work or run while not running', () => {
    const paged = applyBackfillPage(runningRun(), [{ _id: 'a' }]);
    assert.equal(paged.ok, true);
    if (!paged.ok) return;
    const overflow = applyBackfillJobCounts(paged.run, { processed: 2 });
    assert.equal(overflow.ok, false);
    const negative = applyBackfillJobCounts(paged.run, { failed: -1 });
    assert.equal(negative.ok, false);
    const queuedCounts = applyBackfillJobCounts(queuedRun(), { processed: 1 });
    assert.equal(queuedCounts.ok, false);
  });

  it('loses concurrent updates when counts are applied via read-modify-write', () => {
    const paged = applyBackfillPage(runningRun(), [{ _id: 'a' }, { _id: 'b' }], 2);
    assert.equal(paged.ok, true);
    if (!paged.ok) return;
    const snapshot = { ...paged.run };
    const first = applyBackfillJobCounts(snapshot, { processed: 1 });
    const second = applyBackfillJobCounts(snapshot, { processed: 1 });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.run.processedCount, 1);
    assert.equal(second.run.processedCount, 1);
  });

  it('keeps concurrent processed and failed increments with an atomic delta', async () => {
    const counters = { processedCount: 0, failedCount: 0 };
    assert.deepEqual(backfillCountIncrementPatch('processed'), {
      $inc: { processedCount: 1 },
    });
    assert.deepEqual(backfillCountIncrementPatch('failed'), {
      $inc: { failedCount: 1 },
    });
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        Promise.resolve(
          applyAtomicBackfillCountDelta(
            counters,
            index % 4 === 0 ? 'failed' : 'processed',
          ),
        ),
      ),
    );
    assert.equal(counters.processedCount, 30);
    assert.equal(counters.failedCount, 10);
  });

  it('types atomic count patches as Query-compatible $inc updates', () => {
    const processed: Query<BackfillRun> = toBackfillCountUpdateQuery(
      backfillCountIncrementPatch('processed'),
    );
    const failed: Query<BackfillRun> = toBackfillCountUpdateQuery(
      backfillCountIncrementPatch('failed'),
    );
    assert.deepEqual(processed, { $inc: { processedCount: 1 } });
    assert.deepEqual(failed, { $inc: { failedCount: 1 } });
    assert.equal('$set' in processed, false);
    assert.equal('$set' in failed, false);
  });
});

describe('backfill cancellation and resume', () => {
  it('cancels queued and running runs, then allows resume from canceled or failed', () => {
    assert.equal(canCancelBackfill('queued'), true);
    assert.equal(canCancelBackfill('running'), true);
    assert.equal(canCancelBackfill('completed'), false);
    assert.equal(isResumeEligible('canceled'), true);
    assert.equal(isResumeEligible('failed'), true);
    assert.equal(isResumeEligible('completed'), false);
    assert.equal(isResumeEligible('running'), false);

    const canceled = cancelBackfillRun(runningRun(), now);
    assert.equal(canceled.ok, true);
    if (!canceled.ok) return;
    assert.equal(canceled.run.state, 'canceled');
    assert.equal(canceled.run.finishedAt?.toISOString(), now.toISOString());

    const resumed = resumeBackfillRun(canceled.run);
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.run.state, 'queued');
    assert.equal(resumed.run.finishedAt, null);
    assert.equal(resumed.run.error, null);
    assert.equal(resumed.run.cursor, canceled.run.cursor);
    assert.equal(resumed.run.scannedCount, canceled.run.scannedCount);

    assert.equal(canCancelBackfill('canceled'), false);
    const alreadyCanceled = cancelBackfillRun(canceled.run, now);
    assert.equal(alreadyCanceled.ok, true);
    if (!alreadyCanceled.ok) return;
    assert.equal(alreadyCanceled.run.state, 'canceled');

    const alreadyQueued = resumeBackfillRun(resumed.run);
    assert.equal(alreadyQueued.ok, true);
    if (!alreadyQueued.ok) return;
    assert.equal(alreadyQueued.run.state, 'queued');

    const queuedFailed = failBackfillRun(
      queuedRun(),
      'enqueue failed apiKey=sk-test',
      now,
    );
    assert.equal(queuedFailed.ok, true);
    if (!queuedFailed.ok) return;
    assert.equal(queuedFailed.run.state, 'failed');
    assert.doesNotMatch(queuedFailed.run.error ?? '', /sk-test|apiKey=/);

    const failed = failBackfillRun(runningRun(), 'provider timeout', now);
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    const resumedFailed = resumeBackfillRun(failed.run);
    assert.equal(resumedFailed.ok, true);
    if (!resumedFailed.ok) return;
    assert.equal(resumedFailed.run.state, 'queued');
    assert.equal(resumedFailed.run.error, null);
  });

  it('preserves cursor across cancel and resume so paging can continue', () => {
    const paged = applyBackfillPage(runningRun(), [{ _id: 'a' }, { _id: 'b' }]);
    assert.equal(paged.ok, true);
    if (!paged.ok) return;
    const canceled = cancelBackfillRun(paged.run, now);
    assert.equal(canceled.ok, true);
    if (!canceled.ok) return;
    const resumed = resumeBackfillRun(canceled.run);
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    const restarted = startBackfillRun(resumed.run, now);
    assert.equal(restarted.ok, true);
    if (!restarted.ok) return;
    assert.equal(restarted.run.cursor, 'b');
    assert.equal(restarted.run.startedAt?.toISOString(), now.toISOString());
  });
});

describe('backfill bounds', () => {
  it('clamps batch size into the configured inclusive range', () => {
    assert.deepEqual(boundBackfillBatchSize(undefined), {
      ok: true,
      batchSize: DEFAULT_BACKFILL_BATCH_SIZE,
    });
    assert.deepEqual(boundBackfillBatchSize(0), {
      ok: true,
      batchSize: MIN_BACKFILL_BATCH_SIZE,
    });
    assert.deepEqual(boundBackfillBatchSize(10_000), {
      ok: true,
      batchSize: MAX_BACKFILL_BATCH_SIZE,
    });
    assert.deepEqual(boundBackfillBatchSize(50, 25), { ok: true, batchSize: 25 });
    assert.equal(boundBackfillBatchSize(1.5).ok, false);
    assert.equal(boundBackfillBatchSize(Number.NaN).ok, false);
    assert.equal(boundBackfillBatchSize(10, 0).ok, false);
  });

  it('bounds pages to batch size and rejects oversized apply calls', () => {
    const docs = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
    assert.deepEqual(boundBackfillPage(docs, 2), [{ _id: 'a' }, { _id: 'b' }]);
    const oversized = applyBackfillPage(runningRun(), docs);
    assert.equal(oversized.ok, false);
    if (oversized.ok) return;
    assert.equal(oversized.reason, 'page_size');
  });

  it('rejects oversized filters, dangerous operators, and invalid identity', () => {
    assert.equal(createQueuedBackfill({ schemaName: '../etc' }).ok, false);
    assert.equal(
      createQueuedBackfill({ schemaName: 'Article', configId: 'bad id' }).ok,
      false,
    );
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: { $where: 'this.password' },
      }).ok,
      false,
    );
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: { title: { $regex: 'a+' } },
      }).ok,
      false,
    );
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: { $or: [{ published: true }] },
      }).ok,
      false,
    );
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: { title: { $exists: true } },
      }).ok,
      false,
    );
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: { body: { $like: '%secret%' } },
      }).ok,
      false,
    );
    assert.equal(createQueuedBackfill({ schemaName: 'Article', filter: [] }).ok, false);
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: { body: 'x'.repeat(MAX_BACKFILL_FILTER_BYTES) },
      }).ok,
      false,
    );
    assert.equal(
      createQueuedBackfill({
        schemaName: 'Article',
        filter: {
          status: {
            $in: Array.from({ length: MAX_BACKFILL_FILTER_IN_VALUES + 1 }, () => 'a'),
          },
        },
      }).ok,
      false,
    );
    assert.equal(
      isSafeBackfillFilter({ published: true, status: { $in: ['draft', 'live'] } }),
      true,
    );
    assert.equal(
      isSafeBackfillFilter({ $and: [{ published: true }, { views: { $gte: 1 } }] }),
      true,
    );
  });
});

describe('backfill sanitized errors', () => {
  it('redacts secrets and truncates stored failure text', () => {
    const failed = failBackfillRun(
      runningRun(),
      new Error('provider failed apiKey=sk-secret Bearer tok-live'),
      now,
    );
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    assert.equal(failed.run.state, 'failed');
    assert.match(failed.run.error ?? '', /\[REDACTED\]/);
    assert.doesNotMatch(failed.run.error ?? '', /sk-secret|tok-live/);

    const long = sanitizeBackfillError('e'.repeat(MAX_BACKFILL_ERROR_LENGTH + 50));
    assert.equal(long.length, MAX_BACKFILL_ERROR_LENGTH);
  });
});
