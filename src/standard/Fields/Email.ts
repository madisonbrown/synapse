import { Serializer } from "../../base";
import { FieldType } from '../../base/Field';
import { Text } from "./Text";

const REGEX = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

export class Email<T extends FieldType> extends Text<T> {
  constructor(properties: Omit<Email<T>['properties'], 'active' | 'inactive' | 'rules'>) {
    super(properties);

    this.assert(REGEX, true, 'must be a valid email address');
  }

  protected async _parse(value: unknown) {
    return (await super._parse(value)).toLowerCase();
  }

  static import: <T extends FieldType>(data: Email<T>['properties']) => Email<T>;
};

Serializer.declare(Email);
