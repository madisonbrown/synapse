import { Postgres, Broker, Cache, Reactor, Http, Ws } from "../../../src";

const postgres = new Postgres('postgres', { 
  connectionString: 'postgres://127.0.0.1:5432' 
});
const broker = new Broker();
const cache = new Cache('cache', { 
  broker 
});
const reactor = new Reactor('reactor', { 
  broker 
});
const http = new Http('http', { 
  port: 3000, 
  authenticator: async (headers) => {
    if (headers.client_id) {
      return headers.client_id;
    }
  },
  cache,
});
const ws = new Ws('ws', { 
  port: 3001, 
  authenticator: async (headers) => {
    if (headers.client_id) {
      return headers.client_id;
    }
  },
  cache,
});

broker.register((ctx) => {
  const trx = postgres.getTransaction(ctx);

  if (trx) {
    return {
      add: async (key, value, postCommit) => {
        await trx.query(`
          insert into outbox (id, data) values ('${key}', '${value}');
        `);
        trx.onCommit(postCommit);
      },
      remove: async (key, preCommit) => {
        if (key === null) {
          // fix
          return;
        }
        const { rows: [result] } = await trx.query<string>(`
          select data from outbox where id = '${key}' limit 1;
        `)
        await preCommit(result);
      },
    };
  }
});

broker.connect(); // fix

export { cache, postgres, http, ws, reactor };
