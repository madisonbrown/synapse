import { Serializer } from "../../base";
import { Field, FieldProperties, FieldType } from '../../base/Field';

export type TextProperties<T extends FieldType> = FieldProperties<T, string, string> & {
  minLength?: number;
  maxLength?: number;
  rules: {
    regex: string;
    expect: boolean;
    message: string;
  }[]
};

export class Text<T extends FieldType> extends Field<TextProperties<T>> {
  private static cache = new Map<string, RegExp>();

  constructor(properties: Omit<Text<T>['properties'], 'active' | 'inactive' | 'rules'>) {
    const { minLength, maxLength, ..._properties } = properties;
    super({ ..._properties, active: 'string', inactive: 'string', rules: [] });
    if (minLength) {
      this.assert(`.{${minLength}}`, true, `must be at least ${minLength} characters`);
    }
    if (maxLength) {
      this.assert(`.{${maxLength + 1}}`, false, `must be at most ${maxLength} characters`);
    }
  }

  assert(rule: string | RegExp, expect: boolean = true, message: string = '') {
    const regex = rule instanceof RegExp ? rule.source : rule;
    this.properties.rules.push({ regex, expect, message });
    return this;
  }

  protected async _parse(value: unknown): Promise<string> {
    const { rules } = this.properties;
    const _value = String(value);

    rules.forEach(({ regex, expect, message }) => {
      const _regex = Text.cache.get(regex) || new RegExp(regex);
      if (Boolean(_value.match(_regex)) !== expect) {
        throw Field.Error.UNPARSABLE(message);
      }
      Text.cache.set(regex, _regex);
    });

    return _value;
  }

  async store(value: string) {
    return value;
  }
  
  static import: <T extends FieldType>(data: TextProperties<T>) => Text<T>;
};

Serializer.declare(Text);
