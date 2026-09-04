import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderMessageTemplate } from './template.js';

describe('renderMessageTemplate', () => {
  it('substitutes exact placeholders with the raw JSON value', () => {
    const rendered = renderMessageTemplate(
      { id: '{{payload._id}}', count: '{{payload.count}}' },
      { _id: 'abc', count: 3 },
    );
    assert.deepEqual(rendered, { id: 'abc', count: 3 });
  });

  it('interpolates placeholders inside strings', () => {
    const rendered = renderMessageTemplate(
      { label: 'Order {{payload.status}}' },
      { status: 'paid' },
    );
    assert.deepEqual(rendered, { label: 'Order paid' });
  });

  it('fails closed when a placeholder is missing', () => {
    assert.throws(
      () => renderMessageTemplate({ id: '{{payload.missing}}' }, { _id: 'abc' }),
      { name: 'EventRelayValidationError' },
    );
  });

  it('rejects prototype paths in placeholders', () => {
    assert.throws(
      () =>
        renderMessageTemplate(
          { hack: '{{payload.__proto__.polluted}}' },
          { __proto__: { polluted: true } },
        ),
      { name: 'EventRelayValidationError' },
    );
  });
});
