import { Serializer, FieldSet, ProtoArgSet, Schema } from "../../base";
import { HttpStatus } from "../../util";
import { Text } from '../Fields';

export class State<T extends FieldSet> extends Schema<T> {
  readonly status?: number;

  constructor(
    schema: T | Schema<T>,
  ) {
    super(
      schema instanceof Schema 
        ? schema.fields
        : schema
    );
  }

  get [HttpStatus](): number {
    if (!this.status) {
      throw new Error('Uninitialized');
    }
    return this.status;
  }

  export(): any {
    const { _data: data, status: $status, fields } = this;
    return data ? { ...data, $status } : fields;
  }

  async import(input: (ProtoArgSet<T> & { $status?: number }) | State<T>): Promise<State<T>> {
    if (input instanceof State) {
      return input; // fix: validate
    }
    const { $status, ...data } = input;
    return Object.assign(
      await super.import(data as ProtoArgSet<T>) as State<T>,
      { status: $status },
    );
  }

  static import<T extends FieldSet>(fields: T | State<T>): State<T> {
    const Type = this;

    if (fields instanceof State) {
      return fields;
    }
    
    return new Type(fields);
  }

  static Response() {
    return new State({ 
      message: new Text({ type: 'optional' }),
    });
  }

  static async Ok(message?: string) {
    return this.Response().import({ message, $status: 200 });
  }

  static async Created(message?: string) {
    return this.Response().import({ message, $status: 201 });
  }

  static async Accepted(message?: string) {
    return this.Response().import({ message, $status: 202 });
  }

  static async NoContent(message?: string) {
    return this.Response().import({ message, $status: 204 });
  }
}

Serializer.declare(State);
