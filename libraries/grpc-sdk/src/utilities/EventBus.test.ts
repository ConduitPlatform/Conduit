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

  unsubscribe(channel: string, cb?: () => void) {
    void channel;
    cb?.();
  }

  publish(channel: string, message: string) {
    void channel;
    void message;
  }

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
    prefix: '',
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
      () => bus.subscribeAck('chan', () => {}, 'relay-a'),
      /subscribe failed/,
    );
    sub.failNext.delete('chan');
    let count = 0;
    await bus.subscribeAck(
      'chan',
      () => {
        count += 1;
      },
      'relay-a',
    );
    sub.emitMessage('chan', 'x');
    assert.equal(count, 1);
  });

  describe('deployment prefix', () => {
    class Broker {
      clients = new Set<BrokerClient>();
      published: string[] = [];
      publish(channel: string, message: string) {
        this.published.push(channel);
        for (const c of this.clients) {
          if (c.subscribed.has(channel)) c.emitMessage(channel, message);
        }
      }
    }
    class BrokerClient extends FakeRedis {
      constructor(readonly broker: Broker) {
        super();
        broker.clients.add(this);
      }
      override unsubscribe(channel: string, cb?: () => void) {
        this.subscribed.delete(channel);
        cb?.();
      }
      override publish(channel: string, message: string) {
        this.broker.publish(channel, message);
      }
    }
    function busOn(broker: Broker, prefix = '') {
      const manager = {
        prefix,
        getClient: (options?: { keyPrefix?: string }) => {
          assert.equal(options?.keyPrefix, 'bus_');
          return new BrokerClient(broker);
        },
      };
      return new EventBus(manager as never);
    }

    it('prefixes subscribe/publish/unsubscribe channels and strips it on dispatch', async () => {
      const broker = new Broker();
      const a1 = busOn(broker, 'tenant-a:');
      const a2 = busOn(broker, 'tenant-a:');
      const got: string[] = [];
      await a1.subscribeAck('admin:config:update', m => got.push(m), 'sub');
      const subClient = [...broker.clients].find(c => c.subscribed.size > 0)!;
      assert.deepEqual([...subClient.subscribed], ['tenant-a:admin:config:update']);
      a2.publish('admin:config:update', '{"x":1}');
      assert.deepEqual(broker.published, ['tenant-a:admin:config:update']);
      assert.deepEqual(got, ['{"x":1}']);
      a1.unsubscribe('sub');
      assert.equal(subClient.subscribed.size, 0);
    });

    it('isolates deployments with different prefixes on the same Redis', async () => {
      const broker = new Broker();
      const a = busOn(broker, 'tenant-a:');
      const b = busOn(broker, 'tenant-b:');
      const legacy = busOn(broker);
      const seen: Record<string, string[]> = { a: [], b: [], legacy: [] };
      await a.subscribeAck('config', m => seen.a.push(m));
      await b.subscribeAck('config', m => seen.b.push(m));
      await legacy.subscribeAck('config', m => seen.legacy.push(m));
      busOn(broker, 'tenant-a:').publish('config', 'for-a');
      busOn(broker, 'tenant-b:').publish('config', 'for-b');
      busOn(broker).publish('config', 'for-legacy');
      assert.deepEqual(seen, { a: ['for-a'], b: ['for-b'], legacy: ['for-legacy'] });
      assert.deepEqual(broker.published, [
        'tenant-a:config',
        'tenant-b:config',
        'config',
      ]);
    });

    it('ignores messages on channels outside its prefix', () => {
      const broker = new Broker();
      const a = busOn(broker, 'tenant-a:');
      let count = 0;
      a.subscribe('config', () => (count += 1));
      for (const c of broker.clients) c.emitMessage('config', 'x');
      assert.equal(count, 0);
    });
  });
});
