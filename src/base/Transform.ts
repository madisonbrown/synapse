import { Exception } from "./Exception";
import { Serializer, GenericImporter, Input as In, Output as Out, GenericExportable } from "./Serializer";

export type TransformProperties = {
  input?: GenericImporter;
  output?: GenericImporter;
}
export type GenericTransform = Transform<any, any>; // fix

type Input<P extends TransformProperties> = P['input'] extends GenericImporter ? In<P['input']> : undefined;
export type Validated<P extends TransformProperties> = P['input'] extends GenericImporter ? Out<P['input']>: GenericExportable;
export type Transformed<P extends TransformProperties> = P['output'] extends GenericImporter ? In<P['output']> : undefined;
type Output<P extends TransformProperties> = P['output'] extends GenericImporter ? Out<P['output']> : undefined;

export type Middleware<C, T extends GenericTransform> = (
  args: Validated<T['properties']>,
  ctx: Partial<C>, 
  next: (args: Validated<T['properties']>, ctx: C) => Promise<Output<T['properties']>>, 
) => void;
type Action<P extends TransformProperties, C extends {}> = 
  (args: Validated<P>, ctx: C) => Promise<Transformed<P>>;

export class Transform<P extends TransformProperties, C extends {}> extends Function {
  static Error = Exception.group({
    BAD_INPUT: (description: string = '') => ({ message: `Error while validating input: ${description}` }),
    BAD_OUTPUT: (description: string = '') => ({ message: `Error while validating output: ${description}` }),
    SERVICE_ERROR: (description: string = '') => ({ message: `Error in service middleware: ${description}` }),
    HANDLER_ERROR: (description: string = '') => ({ message: `Error in handler: ${description}` }),
    UNINITIALIZED: (description: string = '') => ({ message: `Required properties have not been set: ${description}` }),
  });

  protected middleware: Middleware<Partial<C>, Transform<P, C>>[] = [];
  protected action?: Action<P, C>;

  constructor(
    readonly properties: P,
  ) {
    super(`
      const _this = arguments.callee;
      return _this.invoke.apply(_this, [...arguments]);
    `);
  }

  protected default(args: Validated<P>, ctx: C): Promise<Transformed<P>> {
    const Type = this.constructor;
    throw new Error(`No default action specified for Transform type '${Type.name}'.`)
  };

  define<T extends {}>(props: T): Transform<P & T, C> {
    Object.assign(this.properties, props);
    return this as any;
  }

  from<T extends GenericImporter>(input: T): Transform<P & { input: T }, C> {
    Object.assign(this.properties, { input });
    return this as any;
  }

  to<T extends GenericImporter>(output: T): Transform<P & { output: T }, C> {
    Object.assign(this.properties, { output });
    return this as any;
  }

  using<T extends {}>(
    service: (t: Transform<P, C>) => Middleware<T, Transform<P, C>> // fix
  ): Transform<P, C & T> {
    this.middleware.push(service(this) as any);
    return this as any;
  }

  by(action: Action<P, C>) {
    this.action = action;
    return this;
  }

  proxy(): Transform<P, C> & Transform<P, C>['invoke'] {
    return this as any;
  }

  async invoke(args: Input<P>, ctx?: C): Promise<Output<P>> {
    const { output, input } = this.properties;

    if (!output || !input) {
      throw Transform.Error.UNINITIALIZED();
    }

    const action = this.action || this.default.bind(this)

    const context: Partial<C> = ctx || {};
    const chain = [
      ...this.middleware, 
      async (args: any, ctx: any) => {
        let transformed: any = undefined;
        try {
          transformed = await action(args, ctx as any);
        } catch (err) {
          console.log(err);
          throw Transform.Error.HANDLER_ERROR(String(err));
        }
       try {
        return await output.import(transformed);
       } catch (err) {
        throw Transform.Error.BAD_OUTPUT(String(err));
       }
      }
    ];
    const next = async (_args: Validated<P>, _ctx: Partial<C>): Promise<Transformed<P>> => {
      const fn = chain.shift();
      if (!fn) {
        throw new Error('Unexpected state');
      }
      return fn(_args, Object.assign(context, _ctx), next) as any;
    };

    let validated: Validated<P>;
    try {
      validated = await input.import(args) as Validated<P>;
    } catch (err) {
      throw Transform.Error.BAD_INPUT(String(err));
    }

    let result: Output<P>;
    try {
      result = await next(validated, context) as Output<P>;
    } catch (err) {
      Exception.handle(Transform.Error, err, {
        BAD_OUTPUT: (err) => {
          throw err;
        }
      });
      throw Transform.Error.SERVICE_ERROR(String(err));
    }

    return result;
  }

  export() {
    return this.properties;
  }

  static import<P extends TransformProperties>(
    properties: ReturnType<Transform<P, {}>['export']>,
  ): Transform<P, {}> & Transform<P, {}>['invoke'] {
    const Type = this;
    return new Type(properties) as any;
  }
}

Serializer.declare(Transform);
