import { Clean, Has } from "../util";
import { Serializer } from "./Serializer";

type Filter<T, U, V = null> = T extends U 
  ? V extends null ? T : V
  : Has<T, U> extends true 
    ? Clean<{ [P in keyof T]: Filter<T[P], U, V> }>
    : never;

type Validator<N> = (node: N, namespace: string[]) => boolean;
type Transform<N, O> = (node: N, namespace: string[]) => O;
export type NodeType<T extends Tree> = Parameters<Parameters<T['map']>[0]>[0];

export class Tree<N = any, T = any> {
  private paths: Set<string>;
  readonly nodes: Filter<T, N>;

  constructor(nodes: T | N | Tree<N, T>) {
    this.paths = new Set('');
    this.nodes = nodes instanceof Tree 
      ? nodes.nodes 
      : nodes as Filter<T, N>;
  }

  private static crawl(
    node: any, 
    filter: Transform<any, any>, 
    namespace: string[] = [], 
    cache: Set<any> = new Set()
  ): any {
    const _node = filter(node, namespace);

    if (_node !== undefined) {
      return _node;
    }
    
    const isNamespace = node && (
      typeof node === 'function' 
        || (typeof node === 'object' && !Array.isArray(node))
    );

    if (isNamespace && !cache.has(node)) {
      cache.add(node);

      const result: any = {};
      Object.keys(node).forEach(key => {
        const val = Tree.crawl(node[key], filter, [...namespace, key], cache);
        if (val !== undefined) {
          result[key] = val;
        }
      });

      if (Object.keys(result).length) {
        return result;
      }
    }
  }

  filter<O>(validator: Validator<O>): Tree<O, Filter<T, N>> {
    const paths = new Set<string>();
    const nodes = Tree.crawl(this.nodes, (node, namespace) => {
      if (validator(node, namespace)) {
        paths.add(namespace.join('.'));
        return node;
      }
    });
    return Object.assign(new Tree(nodes), { paths });
  }

  map<O>(transform: Transform<N, O>): Tree<O, Filter<T, N, O>> {
    const { paths } = this;
    const nodes = Tree.crawl(this.nodes, (node, namespace) => {
      if (paths.has(namespace.join('.'))) {
        return transform(node, namespace);
      }
    });
    return Object.assign(new Tree(nodes), { paths });
  }

  export() {
    return this.nodes;
  }

  static import<T>(nodes: T) {
    return new Tree(nodes)
  }
}

Serializer.declare(Tree);
