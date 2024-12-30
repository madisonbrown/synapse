import { WebSocket } from 'isomorphic-ws';
import { GenericImporter, Input, Output, Serializer, Transform, Transformed, TransformProperties, Validated } from "../../base";
import type { CommandMap, Commands, Update } from '../Services/Servers';

const RECONNECT_WINDOW = 10; // seconds

type Callback = (value: any) => void;
type Handler<T extends CommandMap[string]> = (
  args: Parameters<T>[0],
  update: Parameters<T>[1],
  _super: T,
) => ReturnType<T>;
type Overrides<T extends CommandMap> = Partial<{
  [P in keyof T]: Handler<T[P]>;
}>;

// TODO: use native browser implementation
const toQueryString = (data: any) =>
  Object.entries(data)
    .reduce((query, [key, val]) => [...query, `${key}=${val}`], [] as string[])
    .join('&');

class Wsc<T extends CommandMap> {
  private host: string;

  private counter: number = 0;

  private pending = new Map<
    string,
    { resolve: Callback; reject: Callback; update?: Callback }
  >();

  private overrides: Overrides<T>;

  private active = false;

  private ws?: WebSocket;

  protected proxy?: T;

  constructor(host: string, overrides: Overrides<T> = {}) {
    this.host = host;
    this.overrides = overrides;
  }

  protected async connect(params: any = {}) {
    return new Promise<void>(async (resolve, reject) => {
      this.ws = new WebSocket(`${this.host}?${toQueryString(params)}`);
      this.ws.onopen = () => {
        setTimeout(resolve, 2000); // TODO: fix
      };
      this.ws.onerror = (err) => {
        reject(err);
      };
      this.ws.onmessage = (ev) => {
        this.receive(ev.data.toString());
      };
      this.ws.onclose = () => {
        if (this.active) {
          const delay =
            ((RECONNECT_WINDOW + Math.random() * RECONNECT_WINDOW) * 1000) / 2;
          setTimeout(() => this.connect().catch(console.error), delay);
        }
      };
    });
  }

  private send(method: string, args: any, update?: Callback) {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        return reject(new Error('Unexpected state.'));
      }

      const id = String(this.counter);
      this.counter += 1;
      this.pending.set(id, { resolve, reject, update });
      this.ws.send(JSON.stringify({ method, args, id }), (error) => {
        if (error) {
          reject(error);
        }
      });
    });
  }

  private receive(msg: string) {
    const data: Update<any> = (() => {
      try {
        return JSON.parse(msg);
      } catch (err) {
        return {};
      }
    })();

    const handler = this.pending.get(data.id || '');

    if (!handler) {
      return;
    }

    switch (data.status) {
      case 'SUCCESS': {
        return handler.resolve(data.payload);
      }
      case 'UPDATE': {
        if (!handler.update) {
          return;
        }
        return handler.update(data.payload);
      }
      case 'FAILURE': {
        return handler.reject(new Error(data.message));
      }
      default: {
        return handler.reject(new Error('Unexpected response.'));
      }
    }
  }

  quit() {
    this.active = false;
    // eslint-disable-next-line no-unused-expressions
    this.ws?.close();
    this.ws = undefined;
    this.active = false;
  }

  async initialize(): Promise<T> {
    if (!this.active) {
      await this.connect();

      const _this = this;
      this.proxy = new Proxy(this, {
        get(_, method) {
          if (typeof method !== 'string') {
            throw new Error('Invalid method.');
          }

          // TODO: fix
          if (method === 'then') {
            return _this.proxy as any;
          }

          return (args: any, update?: Callback) => {
            const _super: CommandMap[string] = async (_args, _update) =>
              _this.send(method, _args, _update);
            const handler = _this.overrides[method];

            return handler
              ? handler(args, update as any, _super as any)
              : _super(args, update as any);
          };
        },
      }) as any;

      this.active = true;
    }

    return this.proxy as T;
  }
}

export class Subscription<T extends GenericImporter> {
  protected updaters: ((state: Output<T>) => Promise<void>)[] = [];
  protected cancelers: (() => Promise<void>)[] = [];
  protected _data: Output<T> | undefined;
  readonly name: string;

  constructor(
    protected validator: T, 
  ) {
    this.name = this.constructor.name;
  }

  get data() {
    if (!this._data) {
      throw new Error('Subscription uninitialized')
    }
    return this._data;
  }

  async update(data: Input<T>) {
    this._data = await this.validator.import(data) as Output<T>;
    await Promise.all(
      this.updaters.map((handler) => handler(this.data))
    );
  }

  async cancel() {
    await Promise.all(
      this.cancelers.map((handler) => handler())
    );
  }

  onUpdate(handler: (state: Output<T>) => Promise<void>) {
    this.updaters.push(handler);
  }
  onCancel(handler: () => Promise<void>) {
    this.cancelers.push(handler);
  }

  async export() {
    const { _data: data, validator } = this;
    return data ? { data: await data.export() } : { validator };
  }

  async import(input: { data: Input<T> } | Subscription<T>) {
    const data = input instanceof Subscription
      ? await input.data.export()
      : input.data;
    const instance = new Subscription(this.validator);
    await instance.update(data);
    if (input instanceof Subscription) {
      instance.updaters = input.updaters;
      instance.cancelers = input.cancelers;
    }
    return instance;
  }

  static import<T extends GenericImporter>(
    input: { validator: T } | Subscription<T>
  ): Subscription<T> {
    return input instanceof Subscription
      ? input
      : new Subscription(input.validator);
  }
}

export type WsrNode = { 
  input: TransformProperties['input'];
  output: Subscription<any>;
  name: string;
};

export class WsRemote<T extends WsrNode> extends Transform<T, never> {
  protected static _config?: { host: string };
  protected static _client?: Promise<Commands>;

  protected static get config() {
    if (!this._config) {
      throw new Error(`'Ws' not initialized`);
    }
    return this._config;
  }
  protected static get client() {
    if (!this._client) {
      this._client = new Wsc<Commands>(this.config.host).initialize();
    }
    return this._client;
  }

  protected async default(
    _args: Validated<T>
  ): Promise<Transformed<T>> {
    return new Promise(async (resolve, reject) => {
      try {
        const client = await WsRemote.client;
        const { name } = this.properties;
        const args = await _args.export();
        console.log(`${name}(${JSON.stringify(args)})`);
        let subscription: Subscription<any> | undefined;
        const response = client.subscribe({ name, args }, async (data) => {          
          if (!subscription) {
            subscription = await this.properties.output.import({ data });
            const { subscriptionId } = await response;
            subscription.onCancel(async () => {
              await client.unsubscribe({ subscriptionId });
            });
            resolve(subscription as any);
          } else {
            subscription.update(data);
          }
        });
      } catch (err) {
        reject(err);
      }
    })
  }

  static initialize(config: typeof WsRemote['config']) {
    this._config = config;
  }
}

Serializer.declare(Subscription);
Serializer.declare(WsRemote);
