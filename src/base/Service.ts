import { Transform, GenericTransform, Middleware } from "./Transform";
import { Tree } from "./Tree";
import { Serializer } from './Serializer';

export type GenericService = Service<GenericTransform, {}>;
export type ServiceExtension<T extends GenericService = GenericService> = 
  { new(...args: any[]): T } & Pick<typeof Service, 'import'>;

export type Unspecified<A, B> = Omit<A, keyof B> & Partial<{
  [P in keyof A & keyof B]: 
    B[P] extends A[P] ? A[P] : never;
}>;

export class Service<T extends GenericTransform, P extends {}> {
  private _tree?: Tree<T & P>;
  protected properties = new Map<T, { name?: string } & P>();
  protected nodes = new Map<string, T>();

  public get tree() {
    if (!this._tree) {
      throw new Error('Uninitialized');
    }
    return this._tree;
  }

  constructor(
    readonly name: string,
  ) {}

  configure(props: P): (node: T) => Middleware<{}, T> {
    return (node) => {
      this.properties.set(node, props);
      return (args, ctx, next) => {
        next(args, ctx);
      }
    };
  }

  initialize(tree: object) {
    this._tree = new Tree(tree)
      .filter((node: T, namespace) => {
        const configured = node instanceof Transform
          && this.properties.get(node);

        if (configured) {
          configured.name = namespace.join('.');
          this.nodes.set(configured.name, node);
        }

        return !!configured;
      })
      .map((node) => {
        const { name, ...props } = this.properties.get(node) || {}; // fix
        return Object.assign(node, props as P);
      })
  }

  start() {
    console.log(`starting service '${this.name}'`);
  }

  export() {
    return this._tree?.nodes;
  }

  static import<T extends GenericTransform>(data: Tree<T> | undefined): Service<T, {}> {
    const Type = this as any;
    const instance = new Type();
    if (data) {
      instance.initialize(data);
    }
    return instance;
  }
}

Serializer.declare(Service);
