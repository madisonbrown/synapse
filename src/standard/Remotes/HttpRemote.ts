import * as fetch from 'isomorphic-fetch';
import { Serializer, Transform, Transformed, Validated } from "../../base";
import type { HttpNode } from "../Services/Servers/Http";
import { routeToPath } from '../../util';

export class HttpRemote<T extends HttpNode> extends Transform<HttpNode['properties'], never> {
  protected static _config?: { host: string, headers?: any };

  static get config() {
    if (!this._config) {
      throw new Error(`'HttpRemote' not initialized`);
    }
    return this._config;
  }

  protected async default(
    _args: Validated<T['properties']>
  ): Promise<Transformed<T['properties']>> {
    const { host, headers } = HttpRemote.config;
    const { method } = this.properties as any; // fix
    const { path, args } = routeToPath((this.properties as any).path, await _args.export() || {}); // fix
    const [query, body] = method === 'get' 
      ? [args] 
      : [{}, args];
    console.log(`${method} ${host}${path}`, {body});
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`${host}${path}?${qs}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return res.json() as any;
  }

  static initialize(config: typeof HttpRemote['config']) {
    this._config = config;
  }
}

Serializer.declare(HttpRemote);
