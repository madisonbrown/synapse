import { Serializer } from "../../base";
import { FieldType } from '../../base/Field';
import { Text } from "./Text";

export class Enum<T extends FieldType> extends Text<T> {
  readonly options: string[]; // fix

  constructor(properties: Omit<Enum<T>['properties'], 'active' | 'inactive' | 'rules'> & { options: string[] }) {
    const { options, ...props } = properties; 
    
    super(props);

    this.options = options;

    this.assert(
      options.map((val: any) => `(${val})`).join('|'),
      true,
      `must be one of the following values: ${options.join(', ')}.`
    );
  }

  static import: <T extends FieldType>(data: Enum<T>['properties']) => Enum<T>;
};

Serializer.declare(Enum);
