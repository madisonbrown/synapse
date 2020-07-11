/* eslint-disable import/no-cycle */
/* eslint-disable import/extensions */
/* eslint-disable no-param-reassign */

import Validatable from './Validatable';
import Controller from '../control/Controller';
import Router from '../control/Router';
import Schema from '../Schema';
import { mergePaths, parseEndpoint, invokeChain } from '../utility';

const toController = (target: Function, props: object = {}) => {
  return Object.assign(target instanceof Controller ? target : new Controller(target), props);
};

const applyExpose = (Class: any, endpoint: string, ...chain: Array<Function>) => {
  const { method, path } = parseEndpoint(endpoint);

  if (!method || !path) {
    throw new Error(`Invalid endpoint '${endpoint}'.`);
  }

  const controller = toController(chain.pop(), {
    pattern: mergePaths(Class.root(), path),
    cacheable: method === 'get',
    authorizer: async (args: object) => {
      const result = await invokeChain(chain, args);
      return Array.isArray(result) ? result[0] : result;
    },
  });

  if (!Class.router) {
    Class.router = new Router();
  }
  Class.router.declare(method, controller.pattern, controller.try);

  return controller;
};

const applyPath = (Class: any, path: string, target: Function) => {
  const [type, pattern] = path.split(' ');

  return toController(target, {
    pattern: mergePaths(Class.root(), pattern),
    cacheable: type.toLowerCase() === 'read',
  });
};

const applySchema = (Class: any, from: Schema | object, target: Function) => {
  return toController(target, {
    schema: from instanceof Schema ? from : new Schema(from),
  });
};

const applyAffects = (Class: any, paths: Array<string>, target: Function) => {
  const root = Class.root();
  return toController(target, {
    dependents: paths.map((path) => mergePaths(root, path)),
  });
};

const applyUses = (Class: any, paths: Array<string>, target: Function) => {
  const root = Class.root();
  return toController(target, {
    dependencies: paths.map((path) => mergePaths(root, path)),
  });
};

export interface ControllerOptions {
  uses: Array<string>;
  affects: Array<string>;
  schema: Schema | object;
  endpoint: string;
  path: string;
  authorizer: Array<Function>;
}

/** Represents a type which can be exposed by a Synapse API. Defines the functionality necessary to create {@linkcode Controller|Controllers} and add them to a static {@linkcode Controllable.router|router} property on the derived class. */
export default class Controllable extends Validatable {
  static router: Router;

  /** _**(abstract)**_ Returns the _path_ from which all endpoints on the derived class originate. */
  static root(): string {
    throw new Error("Classes that extend Controllable must implement the 'root' method.");
  }

  /** Creates an instance of {@linkcode Controller} intended to be attached to a derived class as a static property.
   * @param options An object defining the endpoint method and pattern, authorizers, schema, and dependencies.
   * @param method A function defining endpoint business logic.
   */
  static expose(options: ControllerOptions, method): Controller {
    const { uses, affects, schema, endpoint, path, authorizer } = options;

    const controller = new Controller(method);
    if (uses) {
      applyUses(this, uses, controller);
    }
    if (affects) {
      applyAffects(this, affects, controller);
    }
    if (schema) {
      applySchema(this, schema, controller);
    }
    if (path) {
      applyPath(this, path, controller);
    } else if (endpoint) {
      const chain = !authorizer || Array.isArray(authorizer) ? authorizer : [authorizer];
      applyExpose(this, endpoint, ...(chain || []), controller);
    }
    return controller;
  }
}

/** Decorator function that creates a partially defined instance of {@linkcode Controller}. Defines {@linkcode Controller.method}, {@linkcode Controller.pattern}, and {@linkcode Controller.authorizer}.
 * @category Decorator
 * @param endpoint An string defining an endpoint HTTP method and _path pattern_ in the format ```METHOD /path/:param```.
 * @param authorizers An array of functions ```(args) => {...}``` that will authorize input arguments of requests to the resulting controller. Should return either an array containg arguments to be passed to the next authorizer, or any other value to abort the operation.
 */
export const expose = (endpoint: string, ...authorizers: Array<Function>): Function => {
  return (Class, methodName, descriptor) => {
    if (!(Class.prototype instanceof Controllable)) {
      throw new Error("The '@expose' decorator can only be used within 'Controllable' types.");
    }

    const method = descriptor.value; // class method to be decorated
    descriptor.value = applyExpose(Class, endpoint, ...authorizers, method);
  };
};

/** Decorator function that creates a partially defined instance of {@linkcode Controller}. Defines {@linkcode Controller.schema}.
 * @category Decorator
 * @param source An instance of {@linkcode Schema}, or an object which can be used to construct an instance of {@linkcode Schema}.
 */
export const schema = (source: Schema | object): Function => {
  return (Class, methodName, descriptor) => {
    if (!(Class.prototype instanceof Controllable)) {
      throw new Error("The '@schema' decorator can only be used within 'Controllable' types.");
    }

    const method = descriptor.value;
    descriptor.value = applySchema(Class, source, method);
  };
};

/** Decorator function that creates a partially defined instance of {@linkcode Controller}. Defines {@linkcode Controller.dependents}.
 * @category Decorator
 * @param paths An array of _path patterns_ representing the paths that should be recalculated when the resulting {@linkcode Controller|controller} executes an operation.
 */
export const affects = (...paths: Array<string>): Function => {
  return (Class, methodName, descriptor) => {
    if (!(Class.prototype instanceof Controllable)) {
      throw new Error("The '@affects' decorator can only be used within 'Controllable' types.");
    }

    const method = descriptor.value;
    descriptor.value = applyAffects(Class, paths, method);
  };
};

/** Decorator function that creates a partially defined instance of {@linkcode Controller}. Defines {@linkcode Controller.dependencies}.
 * @category Decorator
 * @param paths An array of _path patterns_ representing the paths that, when invalidated, should cause the outputs of the resulting {@linkcode Controller|controller's} operations to be invalidated.
 */
export const uses = (...paths: Array<string>): Function => {
  return (Class, methodName, descriptor) => {
    if (!(Class.prototype instanceof Controllable)) {
      throw new Error("The '@uses' decorator can only be used within 'Controllable' types.");
    }

    const method = descriptor.value;
    descriptor.value = applyUses(Class, paths, method);
  };
};
