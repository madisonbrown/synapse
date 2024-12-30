import * as express from 'express';
import * as uuid from 'uuid';
import { GenericExportable, GenericImporter, Importer, Middleware, Serializer, Service, Transform, Unspecified, Validated } from "../../../base";
import { HttpStatus, pick } from '../../../util';
import { Cache } from '../Cache';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type HttpNode = Transform<{ 
  input: GenericImporter, 
  output: Importer<GenericExportable & { [HttpStatus]: number }>
}, any>;
type HttpContext<T> = { requestId?: string, client?: T };
type HttpProperties<T, U extends HttpNode> = { 
  method: HttpMethod;
  path: string;
  authorizer?: (client: T, args: Validated<U['properties']>) => Promise<boolean>;
};

export class Http<T> extends Service<HttpNode, HttpProperties<T, HttpNode>> {
  private server = express();
  private options: {
    port: number;
    authenticator: (headers: { [key: string]: string }) => Promise<T | undefined>;
    cache?: Cache;
  };

  constructor(name: string, options: Http<T>['options']) {
    super(name);
    this.options = options;
    this.server.use(express.json());
    this.server.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', '*');
      res.header('Access-Control-Allow-Headers', '*');
      next();
    })
  }

  configure<U extends HttpNode>(
    props: Pick<HttpProperties<T, U>, 'authorizer'> 
      & Unspecified<Omit<HttpProperties<T, U>, 'authorizer'>, U['properties']>,
  ): (node: U) => Middleware<HttpContext<T>, U> {
    return (node) => {
      const _props = pick(
        { ...(node.properties as any), ...props } as HttpProperties<T, U>,
        ['method', 'path', 'authorizer'],
      );

      super.configure(_props as any)(node);

      const { method, path, authorizer } = _props;
      this.server[method](path, async (req, res) => {
        try {
          const client = await this.options.authenticator(req.headers as any); // fix
  
          if (!client) {
            throw { $status: 401 };
          }
  
          const args = {
            ...(method === 'get' ? req.query : req.body),
            ...req.params,
          };
          const ctx = { requestId: uuid.v4(), client };
          const serializable = await node.invoke(args, ctx);
          const result = await serializable.export();
  
          console.log(serializable);
  
          res
            .status(serializable[HttpStatus])
            .send(result);
        } catch (err: any) {
          console.log(err);
  
          if ('$status' in err) {
            res
              .status(err.$status)
              .send(String(err));
          } else {
            res
              .status(500)
              .send();
          }
        }
      });

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
    
    const { port } = this.options;
    this.server.listen(port, () => console.log(`listening on port ${port}...`));
  }
}

Serializer.declare(Http);
