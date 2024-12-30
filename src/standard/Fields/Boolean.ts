import { Serializer } from "../../base";
import { Field, FieldProperties, FieldType } from '../../base/Field';

export type BooleanProperties<T extends FieldType> = FieldProperties<T, boolean, string>

export class Boolean<T extends FieldType> extends Field<BooleanProperties<T>> {
  constructor(properties: Omit<Boolean<T>['properties'], 'active' | 'inactive'>) {
    super({ ...properties, active: 'boolean', inactive: 'string' });
  }

  protected async _parse(value: unknown): Promise<boolean> {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 0 || value === 1) {
      return !!value;
    }
    
    if (typeof value === 'string') {
      switch(value.toLowerCase()) {
        case 'true':
          return true;
        case 'false':
          return false;
        default:
          break;
      }
    }

    throw Field.Error.UNPARSABLE();
  }

  async store(value: boolean) {
    return value ? 'true' : 'false';
  }

  static import: <T extends FieldType>(data: BooleanProperties<T>) => Boolean<T>;
};

Serializer.declare(Boolean);
