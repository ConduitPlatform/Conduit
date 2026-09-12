import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventBus } from './EventBus.js';

type Listener = (channel: string, message: string) => void;

class FakeRedis {
  handlers: Record<string, Listener[]> = {};
  subscribed = new Set<string>();
  failNext = new Set<string>();

  on(event: string, listener: Listener) {
    this.handlers[event] = this.handlers[event] ?? [];
    this.handlers[event].push(listener);
  }

  subscribe(channel: string, cb?: (err?: Error | null) => void) {
    if (this.failNext.has(channel)) {
      this.failNext.delete(channel);
      cb?.(new Error('subscribe failed'));
      return;
    }
    this.subscribed.add(channel);
    cb?.(null);
  }

  unsubscribe(_channel: string, cb?: () => void) {
    cb?.();
  }

  publish(_channel: string, _message: string) {}

  quit() {}

  emitMessage(channel: string, message: string) {
    for (const listener of this.handlers.message ?? []) {
      listener(channel, message);
    }
  }
}

function createBus() {
  const sub = new FakeRedis();
  const pub = new FakeRedis();
  const manager = {
    getClient: () => sub,
  };
  const bus = new EventBus(manager as never);
  (bus as unknown as { _clientSubscriber: FakeRedis })._clientSubscriber = sub;
  (bus as unknown as { _clientPublisher: FakeRedis })._clientPublisher = pub;
  return { bus, sub };
}

describe('EventBus', () => {
  it('fires once after deactivate/reactivate on the same channel', () => {
    const { bus, sub } = createBus();
    let count = 0;
    bus.subscribe(
      'database:update:Order',
      () => {
        count += 1;
      },
      'relay-a',
    );
    bus.unsubscribe('relay-a');
    bus.subscribe(
      'database:update:Order',
      () => {
        count += 1;
      },
      'relay-a',
    );
    sub.emitMessage('database:update:Order', '{"ok":true}');
    assert.equal(count, 1);
  });

  it('keeps the second subscriber when the first is removed', () => {
    const { bus, sub } = createBus();
    let first = 0;
    let second = 0;
    bus.subscribe(
      'chan',
      () => {
        first += 1;
      },
      'one',
    );
    bus.subscribe(
      'chan',
      () => {
        second += 1;
      },
      'two',
    );
    bus.unsubscribe('one');
    sub.emitMessage('chan', 'x');
    assert.equal(first, 0);
    assert.equal(second, 1);
  });

  it('subscribeAck rejects when Redis subscribe fails', async () => {
    const { bus, sub } = createBus();
    sub.failNext.add('chan');
    await assert.rejects(
      () =>
        bus.subscribeAck(
          'chan',
          () => {},
          'relay-a',
        ),
      /subscribe failed/,
    );
    sub.failNext.delete('chan');
    let count = 0;
    await bus.subscribeAck('chan', () => {
      count += 1;
    }, 'relay-a');
    sub.emitMessage('chan', 'x');
    assert.equal(count, 1);
  });
});
