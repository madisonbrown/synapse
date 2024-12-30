import { Serializer } from "../../base";
import { FieldType } from '../../base/Field';
import { Text } from "./Text";

const REGEX = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

export class Uuid<T extends FieldType> extends Text<T> {
  constructor(properties: Omit<Uuid<T>['properties'], 'active' | 'inactive' | 'rules' >) {
    super(properties);

    this.assert(REGEX, true, 'must be a valid uuid');
  }

  protected async _parse(value: unknown) {
    return (await super._parse(value)).toLowerCase();
  }

  static import: <T extends FieldType>(data: Uuid<T>['properties']) => Uuid<T>;
};

Serializer.declare(Uuid);
