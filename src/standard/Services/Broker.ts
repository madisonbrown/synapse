import * as uuid from 'uuid';
import Redis from 'ioredis';
import { first } from '../../util';

export type Message<T> = {
  id: string;
  time: number;
  data: T;
}
export type Outbox = (ctx: object) => (
  | {
      remove(key: string | null, preCommit: (value: string) => Promise<void>): Promise<void>;
      add(key: string, value: string, postCommit: () => Promise<void>): Promise<void>;
    } 
  | undefined
);

type Handler<T = any> = (channel: string, message: Message<T>) => any;

export class Broker {
  protected outboxes: Outbox[] = [];
  protected redis: Redis;
  protected listener: Redis;
  protected namespace: string;
  protected subscriptions = new Map<string, Set<Handler>>();

  constructor() {
    this.namespace = 'broker';
    this.redis = new Redis('127.0.0.1');
    this.listener = this.redis.duplicate();
  }

  async publish<T>(ctx: object, channels: string[], data: T) {
    const outbox = first(this.outboxes, (el) => el(ctx));
    if (outbox) {
      const id = uuid.v4();
      const time = Date.now(); // fixx
      const message = JSON.stringify({ id, time, data } as Message<T>);
      await outbox.add(id, message, async () => 
        outbox.remove(id, async () => {
          const trx = this.redis.multi();
          trx.xadd(`${this.namespace}:ledger`, '*', 'message', message);
          channels.map((channel) => 
            trx.publish(`${this.namespace}:event:${channel}`, message)
          )
          await trx.exec();
        })
      )
    } else {
      // fix
    }
  }

  async subscribe<T>(channels: string[], handler: Handler<T>) {
    channels.forEach((_channel) => {
      const channel = `${this.namespace}:event:${_channel}`
      const set = this.subscriptions.get(channel) || new Set();
      set.add(handler);
      this.subscriptions.set(channel, set);      
    });
  }

  async unsubscribe(channels: string[], handler: Handler) {
    channels.forEach((_channel) => {
      const channel = `${this.namespace}:event:${_channel}`
      const handlers = this.subscriptions.get(channel);
      
      handlers?.delete(handler);

      if (handlers?.size) {
        this.subscriptions.set(channel, handlers);
      } else {
        this.subscriptions.delete(channel);
      }
    });
  }

  async connect() {
    // TODO: check ledeger for unread events
    this.listener.on('pmessage', (pattern, channel, message) => {
      console.log('EVENT:', message);
      try {
        // TODO: acknowledge receipt
        const data = JSON.parse(message);
        const handlers = this.subscriptions.get(channel);
        const _channel = channel.split(`${this.namespace}:event:`)[1];
        handlers?.forEach(callback => callback(_channel, data));
      } catch (err) {
        return; // fix
      }
    });
    await this.listener.psubscribe(`${this.namespace}:event:*`);
  }

  async purge() {
    
  }

  register(outbox: Outbox) {
    this.outboxes.push(outbox);
  }
}