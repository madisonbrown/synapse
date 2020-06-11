/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
/* eslint-disable import/no-cycle */
/* eslint-disable import/extensions */

import Controllable from "../traits/Controllable";
import Collection from "./Collection";
import Schema from "../validators/Schema";
import Field from "../validators/Field";
import Id from "../fields/Id";
import { mergePaths } from "../utilities";

const { PRV } = Field.Flags;

/** Abstract class representing a RESTful resource exposed by the synapse API. */
export default class Resource extends Controllable {
  /** An instance of {@linkcode Schema} defining the properties necessary to construct an instance of the derived class. */
  static schema: Schema;

  /** Returns the _resource path_ that uniquely locates the instance (i.e. the path to which a ```GET``` request would return the instance). By default, this is the {@linkcode Resource.root|root} path followed by the value on the instance corresponding to the first field on the derived class's schema that extends type {@linkcode Id} (e.g. '/user/123'); however, derived classes may override this behavior. */
  path(): string {
    const Class = <typeof Resource>this.constructor;

    const { fields } = Class.schema;
    const keys = Object.keys(fields);
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i];
      if (fields[key] instanceof Id) {
        return mergePaths(Class.root(), this[key]);
      }
    }

    throw new Error(`No field of type 'Id' found for class ${Class.name}.`);
  }

  render(): object {
    const Class: any = this.constructor;
    const { fields } = Class.schema;

    const result = {};
    Object.keys(fields).forEach((key) => {
      const field: Field = fields[key];
      if (!field.hasFlag(PRV)) {
        result[key] = this[key];
      }
    });
    return result;
  }

  /** Returns the _resource path_ from which all endpoints on the derived class originate. */
  static root(): string {
    const Class = this;

    const name = Class.name
      .split(/(?=[A-Z])/)
      .join("_")
      .toLowerCase();
    return `/${name}`;
  }

  /** Returns a new {@linkcode Schema} containing all the fields of the derived class's schema plus all fields defined on the schemas of each {@linkcode Resource} type in ```Classes```. In case of a collision between field names, precedence will be given to latter {@linkcode Resource|Resources} in ```Classes```, with highest precedence given to the derived class on which the method was called.
   * @param Classes The {@linkcode Resource}
   */
  static union(...Classes: Array<typeof Resource>): Schema {
    const fields = [];
    Classes.forEach((Class: typeof Resource) => {
      if (Class.prototype instanceof Resource) {
        fields.push(Class.schema.fields);
      }
    });

    const Class = <typeof Resource>this;
    return new Schema(Object.assign({}, ...fields, Class.schema.fields));
  }

  /** _**(async)**_ Attempts to create a new instance of the derived class from the plain object ```data```. Throws an ```Error``` if ```data``` cannot be validated using the derived class's {@linkcode Resource.schema|schema}.
   * @param data The key-value pairs from which to construct the {@linkcode Resource} instance.
   */
  static async restore<T extends typeof Resource>(this: T, data: object): Promise<InstanceType<T>> {
    const Type = <typeof Resource>this;

    // validate in the input data using the derived class's schema.
    const result = await Type.schema.validate(data);
    if (!result) {
      console.log(data, Type.schema.lastError);
      throw new Error(`Invalid properties for type '${Type.name}'.`);
    }

    // transfer the resulting values to a new instance of the derived class
    const instance = new Type(200);
    Object.keys(result).forEach((key) => {
      instance[key] = result[key];
    });
    instance.__meta__.dependencies.add(instance.path());

    return <InstanceType<T>>instance;
  }

  static async collection<T extends typeof Resource>(this: T, data: Array<object>): Promise<Collection> {
    const Type = <typeof Resource>this;

    const pending = data.map((obj) => Type.restore(obj));
    return new Collection(await Promise.all(pending));
  }

  static async create<T extends typeof Resource>(this: T, data: object): Promise<InstanceType<T>> {
    const instance = await this.restore(data);
    instance.__meta__.status = 201;
    return instance;
  }

  static $field(field: Field, name: string) {
    const Class = this;

    if (!(field instanceof Field)) {
      throw new Error("Expected instance of Field.");
    }

    if (!Class.schema) {
      Class.schema = new Schema();
    }

    Class.schema = Class.schema.extend({ [name]: field });
  }
}

// decorators:
export const field = (instance: Field): Function => {
  return (target, fieldName) => {
    const Class = target.constructor;
    Class.$field(instance, fieldName);
  };
};

export { expose, schema, affect } from "../traits/Controllable";
