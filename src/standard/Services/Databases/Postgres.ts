import { Pool } from 'pg';
import { GenericTransform, Middleware, Serializer, Service, Unspecified } from "../../../base";
import { pick } from '../../../util';

export type PostgresNode = GenericTransform;
type PostgresContext = { trx: Transaction };
type PostgresProperties = {};

export type Transaction = {
  query: <T = unknown>(text: string, values?: any[]) => Promise<{ rows: T[] }>;
  onCommit: (fn: () => any) => any;
};

export class Postgres extends Service<PostgresNode, PostgresProperties> {
  private pool: Pool;
  private transactions = new Map<any, Transaction>();
  private options: {
    connectionString: string;
  };

  constructor(name: string, options: Postgres['options']) {
    super(name);
    this.pool = new Pool(options);
    this.options = options;
  }

  private async transaction<T>(handler: (trx: Transaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const onCommit: (() => any)[] = [];
    try {
      await client.query('BEGIN');
      const result = await handler({ 
        query: async (query, values) => {
          console.log(query);
          return client.query<any>(query, values);
        },
        onCommit: (fn: () => any) => {
          onCommit.push(fn);
        } 
      });
      await client.query('COMMIT');
      onCommit.forEach((fn) => fn()); // fix error handler
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  configure<U extends PostgresNode>(
    props: Unspecified<PostgresProperties, U['properties']>,
  ): (node: U) => Middleware<PostgresContext, U> {
    return (node) => {
      const _props = pick(
        { ...node.properties, ...props } as PostgresProperties,
        [],
      );

      super.configure(_props)(node);
      
      return async (args, ctx, next) => {
        const { trx } = ctx;
  
        if (trx) {
          return next(args, { trx });
        }
  
        return this.transaction(async (trx) => {
          this.transactions.set(ctx, trx);
          const result = await next(args, { trx });
          this.transactions.delete(ctx);
          return result;
        })
      };
    }
  }

  getTransaction(ctx: any) {
    return this.transactions.get(ctx);
  }
}

Serializer.declare(Postgres);
