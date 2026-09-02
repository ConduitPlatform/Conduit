import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCronJobId,
  getCronPatternFromInputs,
  getCronTimezone,
  normalizeCronInputs,
  planCronSync,
  validateCronPattern,
} from './cron.utils.js';

describe('cron.utils', () => {
  describe('validateCronPattern', () => {
    it('accepts a 5-field pattern in UTC', () => {
      assert.doesNotThrow(() => validateCronPattern('*/5 * * * *', 'UTC'));
    });

    it('accepts a pattern in a named timezone', () => {
      assert.doesNotThrow(() =>
        validateCronPattern('0 2 * * *', 'America/New_York'),
      );
    });

    it('rejects an invalid pattern', () => {
      assert.throws(() => validateCronPattern('not-a-cron', 'UTC'), {
        message: /Invalid cron pattern/,
      });
    });

    it('rejects an invalid timezone', () => {
      assert.throws(() => validateCronPattern('0 2 * * *', 'Not/AZone'), {
        message: /Invalid cron pattern/,
      });
    });
  });

  describe('normalizeCronInputs', () => {
    it('does not dual-write the cron expression into inputs.event', () => {
      const normalized = normalizeCronInputs({
        cronPattern: '*/5 * * * *',
        timezone: 'Europe/Athens',
      });
      assert.equal(normalized.cronPattern, '*/5 * * * *');
      assert.equal(normalized.timezone, 'Europe/Athens');
      assert.equal(normalized.event, undefined);
    });

    it('migrates a legacy inputs.event pattern to cronPattern and strips event', () => {
      const normalized = normalizeCronInputs({
        event: '0 9 * * 1',
      });
      assert.equal(normalized.cronPattern, '0 9 * * 1');
      assert.equal(normalized.timezone, 'UTC');
      assert.equal(normalized.event, undefined);
    });

    it('strips a client-supplied event alias that duplicates cronPattern', () => {
      const normalized = normalizeCronInputs({
        cronPattern: '*/10 * * * *',
        event: '*/10 * * * *',
      });
      assert.equal(normalized.cronPattern, '*/10 * * * *');
      assert.equal(normalized.event, undefined);
    });

    it('validates against inputs.timezone', () => {
      assert.throws(
        () =>
          normalizeCronInputs({
            cronPattern: '0 2 * * *',
            timezone: 'Not/AZone',
          }),
        { message: /Not\/AZone/ },
      );
    });
  });

  describe('getCronPatternFromInputs', () => {
    it('prefers cronPattern over legacy event', () => {
      assert.equal(
        getCronPatternFromInputs({
          cronPattern: '*/5 * * * *',
          event: 'order.created',
        }),
        '*/5 * * * *',
      );
    });

    it('falls back to legacy event', () => {
      assert.equal(getCronPatternFromInputs({ event: '*/15 * * * *' }), '*/15 * * * *');
    });
  });

  describe('getCronTimezone', () => {
    it('defaults to UTC', () => {
      assert.equal(getCronTimezone(undefined), 'UTC');
      assert.equal(getCronTimezone({}), 'UTC');
    });
  });

  describe('planCronSync idempotency', () => {
    const func = {
      _id: 'abc123',
      name: 'nightly',
      inputs: { cronPattern: '0 3 * * *', timezone: 'UTC' },
    };

    it('schedules a missing job once, then is a no-op', () => {
      const first = planCronSync([func], []);
      assert.equal(first.toSchedule.length, 1);
      assert.equal(first.toSchedule[0].jobId, buildCronJobId(func._id));
      assert.equal(first.unchangedJobIds.length, 0);
      assert.deepEqual(first.orphanKeys, []);

      const afterApply = [
        {
          id: first.toSchedule[0].jobId,
          key: 'repeat:functions-cron-queue:cron-abc123',
          pattern: first.toSchedule[0].pattern,
          tz: first.toSchedule[0].timezone,
        },
      ];
      const second = planCronSync([func], afterApply);
      assert.deepEqual(second.toSchedule, []);
      assert.deepEqual(second.unchangedJobIds, [buildCronJobId(func._id)]);
      assert.deepEqual(second.orphanKeys, []);
    });

    it('updates when pattern or timezone changes', () => {
      const existing = [
        {
          id: buildCronJobId(func._id),
          key: 'existing-key',
          pattern: '0 3 * * *',
          tz: 'UTC',
        },
      ];
      const updated = planCronSync(
        [{ ...func, inputs: { cronPattern: '0 4 * * *', timezone: 'UTC' } }],
        existing,
      );
      assert.equal(updated.toSchedule.length, 1);
      assert.equal(updated.toSchedule[0].existingKey, 'existing-key');
      assert.equal(updated.toSchedule[0].pattern, '0 4 * * *');
    });

    it('removes orphan jobs and skips invalid patterns', () => {
      const plan = planCronSync(
        [
          { _id: 'good', name: 'ok', inputs: { cronPattern: '*/5 * * * *' } },
          { _id: 'bad', name: 'nope', inputs: { cronPattern: 'not-a-cron' } },
        ],
        [
          {
            id: 'cron-orphan',
            key: 'orphan-key',
            pattern: '* * * * *',
            tz: 'UTC',
          },
        ],
      );
      assert.deepEqual(plan.orphanKeys, ['orphan-key']);
      assert.equal(plan.toSchedule.length, 1);
      assert.equal(plan.toSchedule[0].functionId, 'good');
      assert.deepEqual(plan.skipped, [{ functionId: 'bad', reason: 'invalid pattern' }]);
    });
  });
});
