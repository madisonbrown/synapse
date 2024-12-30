import { GenericTransform, Middleware, Serializer, Service, Unspecified } from "../../base";
import { pick } from "../../util";
import { Broker, Message } from "./Broker";

export type ReactorNode = GenericTransform;

type ReactorEvent = {
  input: any;
  output: any;
};

type ReactorContext = { trigger: string, event: Message<ReactorEvent> } | {};

type ReactorProperties = { triggers?: Array<ReactorNode | string> };

export class Reactor extends Service<ReactorNode, ReactorProperties> {
  protected links = new Map<string, Set<ReactorNode>>();

  constructor(
    name: string,
    protected options?: {
      broker?: Broker,
    }
  ) {
    super(name);
  }

  configure<U extends ReactorNode>(
    props: Unspecified<ReactorProperties, U['properties']>,
  ): (node: U) => Middleware<ReactorContext, U> {
    return (node) => {
      const _props = pick(
        { ...node.properties, ...props } as ReactorProperties,
        ['triggers'],
      );

      super.configure(_props)(node);

      return async (args, ctx, next) => {
        const name = (() => {
          const configured = this.properties.get(node);
          if (!configured?.name) {
            throw new Error('Node not attached');
          }
          return configured.name;
        })();

        const result = await next(args, {});

        await this.options?.broker?.publish<ReactorEvent>(
          ctx, 
          [name], 
          { 
            input: await args.export(), 
            output: await result.export(),
          }
        );
        
        return result;
      }
    };
  }

  start() {
    super.start();
    
    Array.from(this.properties.entries()).forEach(([node, { triggers }]) => {
      triggers?.forEach((trigger) => {
        const name = typeof trigger === 'string' 
          ? trigger 
          : this.properties.get(trigger)?.name;
        
        if (name) {
          const set = this.links.get(name) || new Set();
          set.add(node);
          this.links.set(name, set);
        }
      })
    });

    this.options?.broker?.subscribe<ReactorEvent>(
      Array.from(this.nodes.values()).map(({ name }) => name || ''), // fix 
      async (name, event) => {
        const nodes = this.links.get(name);

        if (!nodes) {
          return;
        }

        await Promise.all(
          Array.from(nodes).map((node) => node.invoke({}, {
            trigger: name,
            event,
          })),
        );
      }
    );

    console.log('listening...');
  }
}

Serializer.declare(Reactor);
