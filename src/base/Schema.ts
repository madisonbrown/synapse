import { Exception } from './Exception';
import { Serializer } from './Serializer';
import { Field, FieldType, GenericField } from './Field';

export type Resolved<T> = T extends PromiseLike<infer U> ? U : T;

export type Active<F extends GenericField> = Parameters<F['store']>[0];
export type Inactive<F extends GenericField> = Resolved<ReturnType<F['store']>>;
export type Properties<F extends GenericField> = F['properties'];
export type IsOfType<F extends GenericField, T extends FieldType> = Properties<F>['type'] extends T ? true : false;
export type SetOfType<F extends FieldSet, T extends FieldType> = 
  Pick<F, { [K in keyof F]: IsOfType<F[K], T> extends true ? K : never }[keyof F]>;
export type ProtoArgSet<F extends FieldSet> = 
  & { [K in keyof SetOfType<F, 'required'>]: Active<F[K]> }
  & { [K in keyof SetOfType<F, 'optional' | 'default'>]?: Active<F[K]> };
export type ArgSet<F extends FieldSet> = 
  & { [K in keyof SetOfType<F, 'required' | 'default'>]: Active<F[K]> }
  & { [K in keyof SetOfType<F, 'optional'>]?: Active<F[K]> };
export type TransportSet<F extends FieldSet> = { [K in keyof F]: Inactive<F[K]> };
export type PropertySet<F extends FieldSet> = { [K in keyof F]: Properties<F[K]> };
export type ErrorSet<F extends FieldSet> = { [K in keyof F]: string };
export type GenericSchema = Schema<FieldSet>;

export type FieldSet = { [key: string]: Field<any> };

export class Schema<F extends FieldSet> {
  static Error = Exception.group({
    INVALID_ARGS: (rules: { [key: string]: string }) => ({ message: 'Invalid args.', rules }),
  });

  readonly name: string;
  readonly fields: F;
  protected _data?: ArgSet<F>;

  constructor(fields: F) {
    this.name = this.constructor.name;
    this.fields = fields;
  }

  get data() {
    if (!this._data) {
      throw new Error('Uninitialized');
    }
    return this._data;
  }

  clone<T extends Schema<F>>(this: T, properties: Partial<PropertySet<F>> = {}): Schema<F> {
    const fields: any = {};
    Object.keys(this.fields).forEach((name) => {
      fields[name] = this.fields[name].clone(properties[name]);
    });
    return new Schema(fields);
  }

  cast<T extends F[string]['properties']>(properties: T): Schema<{ [P in keyof F]: Field<T> }> {
    const fields: any = {};
    Object.keys(this.fields).forEach((name) => {
      fields[name] = this.fields[name].cast<T>(properties);
    });
    return new Schema(fields);
  }

  extend<G extends FieldSet>(fields: G | Schema<G>): Schema<F & G> {
    if (fields instanceof Schema) {
      const schema = fields;
      fields = schema.clone().fields;
    }

    return new Schema({ ...this.fields, ...fields });
  }

  pick<K extends keyof F>(...keys: K[]): Schema<Pick<F, K>> {
    const result: any = {};

    keys.forEach((key) => {
      if (this.fields[key]) {
        result[key] = this.fields[key].clone();
      }
    });

    return new Schema(result);
  }

  omit<K extends keyof F>(...keys: K[]): Schema<Omit<F, K>> {
    const result = this.clone();

    keys.forEach((key) => {
      delete result.fields[key];
    });

    return result as any; // fix
  }

  async validate(data: ProtoArgSet<F>): Promise<ArgSet<F>> {
    const keys: (keyof F)[] = Object.keys(this.fields);
    const output: any = {};
    const errors: any = {};

    await Promise.all(
      keys.map(async (key) => {
        try {
          output[key] = await this.fields[key].parse(data[key as keyof ProtoArgSet<F>])
        } catch (error) {
          Exception.handle(Field.Error, error, {
            UNPARSABLE: (_error) => {
              errors[key] = _error.data.rule;
            }
          });
        }
      })
    );

    if (Object.keys(errors).length) {
      throw Schema.Error.INVALID_ARGS(errors)
    }

    return output;
  }

  export() {
    return this._data || this.fields;
  }

  async import(data: ProtoArgSet<F>): Promise<Schema<F>> {
    const Type = this.constructor as typeof Schema;
    const _data: any = await this.validate(data);
    return Object.assign(new Type(this.fields), { _data });
  }

  static import<T extends FieldSet>(fields: T | Schema<T>): Schema<T> {
    const Type = this;

    if (fields instanceof Schema) {
      return fields;
    }

    return new Type(fields);
  }
}

Serializer.declare(Schema);
