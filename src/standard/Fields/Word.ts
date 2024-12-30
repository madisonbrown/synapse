import { Serializer } from "../../base";
import { FieldType } from '../../base/Field';
import { Text } from "./Text";

export class Word<T extends FieldType> extends Text<T> {
  constructor(properties: Omit<Word<T>['properties'], 'active' | 'inactive' | 'rules'>) {
    super(properties);

    this.assert(/[^\w]/, false, 'must contain only alphanumeric characters');
  }

  protected async _parse(value: unknown) {
    return (await super._parse(value)).toLowerCase();
  }

  static import: <T extends FieldType>(data: Word<T>['properties']) => Word<T>;
};

Serializer.declare(Word);
