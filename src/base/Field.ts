import { Exception } from './Exception';
import { Serializer } from './Serializer';

type Primitive = string | number | boolean;
type Serial = 'string' | 'number' | 'boolean';
type PrimitiveOf<T> = 
  T extends 'string' ? string
    : T extends 'number' ? number
    : T extends 'boolean' ? boolean
    : never; 
type SerialOf<T> = 
  T extends string ? 'string'
    : T extends number ? 'number'
    : T extends boolean ? 'boolean'
    : never;

export type FieldType = 'required' | 'optional' | 'default';
export type FieldProperties<T extends FieldType, A extends Primitive, I extends Primitive> = {
  type: T;
  active: SerialOf<A>;
  inactive: SerialOf<I>;
  default?: T extends 'default' ? A : never;
  hidden?: boolean;
}
export type GenericFieldProperties = FieldProperties<FieldType, Primitive, Primitive>;
export type GenericField = Field<GenericFieldProperties>;

type Active<T extends GenericFieldProperties> = PrimitiveOf<T['active']>;
type Inactive<T extends GenericFieldProperties> = PrimitiveOf<T['inactive']>;

export class Field<T extends GenericFieldProperties> {
  static Error = Exception.group({
    UNPARSABLE: (rule?: string) => ({ message: 'Unparsable.', rule }),
  });

  readonly properties: T;

  constructor(properties: T) {
    this.properties = properties;
  }

  protected async _parse(value: unknown): Promise<Active<T>> {
    throw new Error('Method `_parse` must be overridden.');
  }

  clone(properties?: T): Field<T> {
    const Type = this.constructor as any;
    
    return new Type({ ...this.properties, ...(properties || {}) });
  }

  cast<U extends FieldProperties<any, Active<T>, Inactive<T>>>(properties: U): Field<U> {
    const Type = this.constructor as any;
    
    return new Type({ ...this.properties, ...(properties || {}) });
  }

  async parse(value: unknown): Promise<T['type'] extends 'optional' ? Active<T> | null : Active<T>> {
    if (value !== null && value !== undefined) {
      return this._parse(value) as any;
    }

    if (this.properties.default !== undefined) {
      return this.properties.default as any;
    }

    if (this.properties.type === 'optional') {
      return null as any;
    }

    throw Field.Error.UNPARSABLE('Must be specified.');
  }

  async store(value: Active<T>): Promise<Inactive<T>> {
    throw new Error('Method `store` must be overridden.');
  }

  export(): any {
    return this.properties;
  }

  static import<T extends typeof Field>(this: T, data: T['prototype']['properties']): T['prototype'] {
    const Type = this;
    return new Type(data) as any;
  }
}

Serializer.declare(Field);
