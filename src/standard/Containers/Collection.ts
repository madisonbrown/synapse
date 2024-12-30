import { GenericImporter, Input, Output, Serializer } from "../../base";
import { HttpStatus } from "../../util";

export class Collection<T extends GenericImporter> {
  readonly name: string;
  protected _status?: number;
  protected _data?: Output<T>[];

  constructor(
    protected validator: T, 
  ) {
    this.name = this.constructor.name;
  }

  get [HttpStatus](): number {
    if (!this._status) {
      throw new Error('Uninitialized');
    }
    return this._status;
  }

  get data() {
    if (!this._data) {
      throw new Error('Uninitialized');
    }
    return this._data;
  }

  async export() {
    if (this._data && this._status) {
      const data = await Promise.all(
        this._data.map((el) => el.export()),
      );
      return { data, status: this._status };
    }
    return this.validator;
  }

  async import(input: ({ data: Input<T>[], status: number }) | Collection<T>): Promise<Collection<T>> {
    const Type = this.constructor as typeof Collection;
    if (input instanceof Type) {
      if (!input._data || !input._status) {
        throw new Error('Uninitialized');
      }
      return input;
    }
    const _data = await Promise.all(
      input.data.map((el) => this.validator.import(el) as any)
    );
    const _status = input.status;
    return Object.assign(new Type(this.validator), { _data, _status });
  }

  static import<T extends GenericImporter>(
    input: T | Collection<T>
  ) {
    const Type = this;
    return input instanceof Collection
      ? input
      : new Type(input);
  }
}

Serializer.declare(Collection);
