import * as url from 'url';
import * as uuid from 'uuid';
import { ServerOptions, WebSocket, WebSocketServer } from 'isomorphic-ws';
import { GenericTransform, Middleware, Serializer, Service, Unspecified, Validated } from "../../../base";
import { pick } from '../../../util';
import { Cache, Unsubscriber } from '../Cache';

export type CommandMap = {
  [key: string]: (args: any, update: (data: any) => void) => Promise<any>;
};
type Request<T extends object> = {
  method: keyof T;
  args: any;
  id?: string;
};
type Response<T extends object> = {
  method: keyof T;
  id?: string;
} & (
  | {
      status: 'SUCCESS';
      payload: any;
    }
  | {
      status: 'FAILURE';
      message: string;
    }
);
export type Update<T extends object> =
  | Response<T>
  | {
      status: 'UPDATE';
      id?: string;
      payload: any;
    };
type WssConfig<T extends CommandMap> = ServerOptions & {
  handlers: Handlers<T>;
  onJoin(clientId: string, headers: any): Promise<boolean>;
  onQuit(clientId: string): Promise<void>;
  onError(type: 'client' | 'server', err: Error): any;
  heartbeatMs?: number;
};
type Handlers<T extends CommandMap> = {
  [P in keyof T]: (
    args: Parameters<T[P]>[0],
    clientId: string,
    update: Parameters<T[P]>[1],
  ) => ReturnType<T[P]>;
};
type ClientData = {
  id: string;
  isAlive: boolean;
};

const wss = <T extends CommandMap>({ handlers, onJoin, onQuit, onError, heartbeatMs, ...options }: WssConfig<T>) => {
  const server = new WebSocketServer(options);
  const clientData = new Map<WebSocket, ClientData>();
  let heartbeat: NodeJS.Timeout | undefined;

  const parse = (msg: string): Request<T> | undefined => {
    const {
      id,
      method,
      args = {},
    }: Request<T> = (() => {
      try {
        return JSON.parse(msg.toString());
      } catch (err) {
        return {};
      }
    })();

    if (method && handlers[method]) {
      return { id, method, args };
    }
  };

  server.on('connection', async (ws, req) => {
    const send = (response: Update<T>) => {
      ws.send(JSON.stringify(response));
    };

    ws.on('pong', () => {
      client.isAlive = true;
    });
    ws.on('error', (err) => {
      onError('client', err);
    });
    ws.on('message', async (msg) => {
      const request = parse(msg.toString());

      if (!request) {
        return;
      }

      const { method, args, id } = request;

      try {
        const payload = await handlers[method](
          args || {},
          client.id,
          (update) => send({ status: 'UPDATE', payload: update, id }),
        );
        send({ status: 'SUCCESS', method, payload, id });
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        send({ status: 'FAILURE', method, message, id });
      }
    });
    ws.on('close', async () => {
      await onQuit(client.id);
      clientData.delete(ws);
    });

    const { query } = url.parse(req.url || '', true);

    const client: ClientData = {
      id: uuid.v4(),
      isAlive: true,
    };

    if (!(await onJoin(client.id, query))) {
      ws.close();
      return;
    }

    clientData.set(ws, client);

    ws.ping();
  });
  server.on('error', (err) => {
    onError('server', err);
  });
  server.on('close', () => {
    if (heartbeat) {
      clearInterval(heartbeat);
    }
  });

  if (heartbeatMs) {
    heartbeat = setInterval(() => {
      server.clients.forEach((ws) => {
        const client = clientData.get(ws);

        if (!client) {
          return;
        }

        if (client.isAlive === false) {
          return ws.terminate();
        }

        client.isAlive = false;
        ws.ping();
      });
    }, heartbeatMs);
  }

  return server;
}

export type WsNode = GenericTransform; 

export type Commands = {
  subscribe(args: { name: string, args: any }, update: (data: any) => void): Promise<{ subscriptionId: string }>;
  unsubscribe(args: { subscriptionId: string }): Promise<boolean>;
}

type WsContext<T> = { requestId?: string, client?: T };
type WsProperties<T, U extends WsNode> = { 
  write?: false; // fix
  authorizer?: (client: T, args: Validated<U['properties']>) => Promise<boolean>;
}

export class Ws<T> extends Service<WsNode, WsProperties<T, WsNode>> {
  protected server?: WebSocketServer;
  protected clients = new Map<string, T>();
  protected subscriptions = new Map<string, Unsubscriber>();
  protected options: {
    port: number;
    authenticator: (headers: { [key: string]: string }) => Promise<T | undefined>;
    cache?: Cache;
  };

  constructor(name: string, options: Ws<T>['options']) {
    super(name);
    this.options = options;
  }

  configure<U extends WsNode>(
    props: Unspecified<WsProperties<T, U>, U['properties']>,
  ): (node: U) => Middleware<WsContext<T>, U> {
    return (node) => {
      const _props = pick(
        { ...node.properties, ...props } as WsProperties<T, U>,
        ['write', 'authorizer'],
      );

      super.configure(_props)(node);

      const { authorizer } = _props;
      return async (args, ctx, next) => {
        if (ctx.client && authorizer && !await authorizer(ctx.client, args)) {
           throw { $status: 403 };
        }
        return next(args, { requestId: ctx.requestId || uuid.v4(), client: ctx.client });
      };
    };
  }

  start() {
    super.start();
    
    const { port, authenticator } = this.options;
    this.server = wss<Commands>({
      port,
      heartbeatMs: 30_000,
      handlers: {
        subscribe: async ({ name, args }, clientId, update) => {
          const node = this.nodes.get(name);

          if (!node) {
            throw { $status: 404 }; // fix
          }

          const client = this.clients.get(clientId);
    
          if (!client) {
            throw { $status: 401 }; // fix
          }

          const _update = async (): Promise<WsContext<T>> => {
            const ctx = { requestId: uuid.v4(), client };
            const serializable = await node.invoke(args, ctx);
            console.log(serializable);
            update(await serializable.export());
            return ctx;
          };

          const unsubscriber = this.options.cache?.onInvalidate(
            await _update() as any, // fix
            _update
          );

          if (!unsubscriber) {
            throw new Error('method not subscribable');
          }

          const subscriptionId = uuid.v4();
          console.log(`creating subscription ${subscriptionId}`);
          this.subscriptions.set(subscriptionId, unsubscriber);
          return { subscriptionId };
        },
        unsubscribe: async ({ subscriptionId }, clientId) => {
          const unsubscriber = this.subscriptions.get(subscriptionId);

          if (unsubscriber) {
            console.log(`destroying subscription ${subscriptionId}`);
            unsubscriber();
            this.subscriptions.delete(subscriptionId);
            return true;
          }

          return false;
        }
      },
      onJoin: async (clientId: string, headers: any): Promise<boolean> => {
        console.log({headers});
        const client = await authenticator(headers);
        if (!client) {
          return false;
        }
        this.clients.set(clientId, client);
        console.log(`client ${clientId} connected`);
        return true;
      },    
      onError: async (type: 'client' | 'server', err: Error) => {
        console.log(`${type} error: `, err);
      },
      onQuit: async (clientId: string): Promise<void> => {
        console.log(`client ${clientId} disconnected`);
      },
    });

    console.log(`listening on port ${port}...`);
  }
}

Serializer.declare(Ws);
