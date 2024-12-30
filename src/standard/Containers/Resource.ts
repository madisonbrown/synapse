import { Schema, GenericSchema, FieldSet, GenericTransform, Transform, ArgSet } from "../../base";
import { HttpStatus, OneOrMore } from "../../util";
import { Collection } from "./Collection";

type Extension = typeof Resource;

export class Resource {
  static readonly schema: GenericSchema = new Schema({});

  readonly data: any;
  readonly status: number;

  get [HttpStatus]() {
    return this.status;
  }
  
  protected constructor(data: any, status: number) {
    this.data = data;
    this.status = status;
  }

  static from<T extends FieldSet >(fields: T) {
    return class extends Resource {
      static readonly schema = new Schema(fields);
      override readonly data!: ArgSet<T>;
    };
  }

  static transform<T extends GenericTransform>(
    config: (node: Transform<{}, {}>) => T,
    action: Parameters<T['by']>[0],
  ): ReturnType<T['proxy']> {
    return config(new Transform({}))
      .by(action)
      .proxy() as any;
  }

  static importer<T extends typeof Resource>(
    this: T
  ): { name: string, import: T['import'] } {
    return this;
  }

  static async init<U extends Extension, V extends OneOrMore<unknown>>(
    this: U, 
    data: V,
  ): Promise<V extends Array<any> ? Collection<U> : Awaited<ReturnType<U['import']>>> {
    const Type = this;
    if (Array.isArray(data)) {
      return new Collection(Type).import({
        data: data.map((el) => ({ ...el, $status: 201 })),
        status: 201,
      }) as any;
    }
    return Type.import({ ...(data as any), $status: 201 }) as any;
  }

  static async recall<U extends Extension, V extends OneOrMore<unknown>>(
    this: U, 
    data: V,
  ): Promise<V extends Array<any> ? Collection<U> : Awaited<ReturnType<U['import']>>> {
    const Type = this;
    if (Array.isArray(data)) {
      return new Collection(Type).import({
        data: data.map((el) => ({ ...el, $status: 200 })),
        status: 200,
      }) as any;
    }
    return Type.import({ ...(data as any), $status: 200 }) as any;
  }

  export() {
    const { data, status: $status } = this;
    return { ...data, $status };
  }

  static async import<U extends Extension>(
    this: U, 
    data: any,
  ): Promise<Resource> {
    const Type = this;

    if (data instanceof Type) {
      return data;
    }

    return new Type(
      await Type.schema.validate(data), 
      data.$status
    );
  }
}
