import { Serializer } from "../../base";
import { Field, FieldProperties, FieldType } from '../../base/Field';

export type NumberProperties<T extends FieldType> = FieldProperties<T, number, number> & {
  min?: number;
  max?: number;
};

export class Number<T extends FieldType> extends Field<NumberProperties<T>> {
  constructor(properties: Omit<Number<T>['properties'], 'active' | 'inactive'>) {
    super({ ...properties, active: 'number', inactive: 'number' });
  }

  protected async _parse(value: unknown): Promise<number> {
    const { min, max } = this.properties;

    if (typeof value !== 'number') {
      throw Field.Error.UNPARSABLE('not a number');
    }
    if (min && value < min) {
      throw Field.Error.UNPARSABLE(`must not be less than ${min}`);
    }
    if (max && value > max) {
      throw Field.Error.UNPARSABLE(`must not be greater than ${max}`);
    }

    return value;    
  }

  async store(value: number) {
    return value;
  }

  static import: <T extends FieldType>(data: NumberProperties<T>) => Number<T>;
};

Serializer.declare(Number);
