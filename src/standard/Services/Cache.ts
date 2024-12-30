import Redis from 'ioredis';
import { GenericTransform, Middleware, Serializer, Service, Unspecified } from "../../base";
import { pick, routeToPath, toJsonDeterministic } from '../../util';
import { Broker } from './Broker';
import { md5 } from '../../util/crypto';

class rMap {
  name: string;

  client: Redis;

  constructor(name: string, client: Redis) {
    this.name = name;
    this.client = client;
  }

  async has(key: string): Promise<boolean> {
    return !!this.client.hexists(this.name, key);
  }

  async get(key: string): Promise<string | undefined> {
    return await this.client.hget(this.name, key) || undefined;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.hset(this.name, key, value);
  }

  async delete(key: string): Promise<boolean> {
    return !!this.client.hdel(this.name, key);
  }
}

class rRelation {
  private name: string;

  private client: Redis;

  constructor(name: string, client: Redis) {
    this.name = name;
    this.client = client;
  }

  async link(from: string, to: string) {
    return Promise.all([
      this.client.sadd(`${this.name}/from`, from),
      this.client.sadd(`${this.name}/from/${from}`, to),
      this.client.sadd(`${this.name}/to`, to),
      this.client.sadd(`${this.name}/to/${to}`, from),
    ]);
  }

  async unlink(from?: string, to?: string) {
    if (from && to) {
      await Promise.all([
        this.client.srem(`${this.name}/from/${from}`, to),
        this.client.srem(`${this.name}/to/${to}`, from),
      ]);
    } else if (from) {
      const toVals = await this.client.smembers(`${this.name}/from/${from}`);
      await Promise.all([
        ...toVals.map((val) => {
          return this.client.srem(`${this.name}/to/${val}`, from);
        }),
        this.client.srem(`${this.name}/from`, from),
      ]);
    } else if (to) {
      const fromVals = await this.client.smembers(`${this.name}/to/${to}`);
      await Promise.all([
        ...fromVals.map((val) => {
          return this.client.srem(`${this.name}/from/${val}`, to);
        }),
        this.client.srem(`${this.name}/to`, to),
      ]);
    }
  }

  async from(val?: string): Promise<IterableIterator<string>> {
    if (val === null) {
      return (await this.client.smembers(`${this.name}/to`)).values();
    }
    return (await this.client.smembers(`${this.name}/from/${val}`)).values();
  }

  async to(val?: string): Promise<IterableIterator<string>> {
    if (val === null) {
      return (await this.client.smembers(`${this.name}/from`)).values();
    }
    return (await this.client.smembers(`${this.name}/to/${val}`)).values();
  }
}

class Global implements Cacher {
  private states: rMap;

  private dependencies: rRelation;

  constructor(namespace: string, client: Redis) {
    this.states = new rMap(`${namespace}/states`, client);
    this.dependencies = new rRelation(`${namespace}/dependencies`, client);
  }

  async get(key: string) {
    return this.states.get(key);
  }

  async set(key: string, data: string, dependencies?: string[]) {
    await Promise.all([
      this.states.set(key, data),
      this.dependencies.unlink(undefined, key),
    ]);

    if (dependencies) {
      await Promise.all(
        dependencies.map(async (_key: string) => 
          this.dependencies.link(_key, key)
        )
      );
    }
  }

  async invalidate(keys: string[]) {
    const queries = new Set<string>(keys);

    await Promise.all(
      keys.map(async (key) => {
        Array.from(await this.dependencies.from(key)).forEach((query) => {
          queries.add(query);
        });
      })
    );
    
    await Promise.all(
      Array.from(queries).map(async (query) => {
        return Promise.all([
          this.states.delete(query),
          this.dependencies.unlink(undefined, query)
        ])
      })
    );
  }
}

export interface Cacher {
  get(query: string): Promise<string | undefined>;
  set(query: string, data: string, dependencies: string[]): Promise<void>;
  invalidate(dependencies: string[]): Promise<void>;
}

export type CacheNode = GenericTransform;
export type CacheContext = { 
  dependencies: Set<string>;
};
type CacheProperties = { 
  path: string;
  write?: boolean;
  cacheable?: boolean;
  dependencies?: string[];
  dependents?: string[];
};

export type Unsubscriber = () => void;
type CacheEvent = true;

export class Cache extends Service<CacheNode, CacheProperties> {
  protected cacher: Cacher;

  constructor(
    name: string,
    protected options?: {
      broker?: Broker,
    }
  ) {
    super(name);
    this.cacher = new Global('cache', new Redis('127.0.0.1'))
  }

  configure<U extends CacheNode>(
    props: Unspecified<CacheProperties, U['properties']>,
  ): (node: U) => Middleware<CacheContext, U> {
    return (node) => {
      const _props = pick(
        { ...node.properties, ...props } as CacheProperties,
        ['path', 'write', 'cacheable', 'dependencies', 'dependents'],
      );

      super.configure(_props)(node);

      const { write } = _props;
      const cacheable = !write && _props.cacheable;
      return async (_args, ctx, next) => {
        const name = (() => {
          const configured = this.properties.get(node);
          if (!configured?.name) {
            throw new Error('Node not attached');
          }
          return configured.name;
        })();
        const args = await _args.export();
        const key = md5(toJsonDeterministic({ name, args }));

        const { path } = routeToPath(_props.path, args);
        const dependencies = ctx.dependencies || new Set<string>();
        const dependents = new Set<string>();
        (() => {
          const [source, target] = !write
            ? [_props.dependencies, dependencies] 
            : [_props.dependents, dependents];
          target.add(path);
          source?.forEach((pattern) => {
            target.add(routeToPath(pattern, args).path);
          });
        })();

        if (cacheable) {
          const cached = await this.cacher.get(key);
          if (cached) {
            Object.assign(ctx, { dependencies }); // fix
            return Serializer.deserialize(cached);
          }
        }

        const result: any = await next(_args, { dependencies }); // try/catch? // fix
        const isError = result instanceof Error;

        if (cacheable) {
          await this.cacher.set(
            key, 
            isError ? '' : await Serializer.serialize(result),
            Array.from(dependencies),
          );
        }

        if (write && !isError) {
          const _dependents = Array.from(dependents);
          await this.cacher.invalidate(_dependents);
          await this.options?.broker?.publish<CacheEvent>(ctx, _dependents, true);
        }

        return result;
      };
    };
  }

  onInvalidate(ctx: CacheContext, handler: () => any): Unsubscriber | undefined {
    if (ctx.dependencies) {
      const dependencies = Array.from(ctx.dependencies);
      this.options?.broker?.subscribe<CacheEvent>(dependencies, handler);
      return () => this.options?.broker?.unsubscribe(dependencies, handler);
    }
  }
}

Serializer.declare(Cache);
