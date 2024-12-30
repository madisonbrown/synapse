import { GenericImporter, Input, Output, Serializer } from "../../base";
import { firstAsync } from "../../util";

export class Multi<T extends GenericImporter> {
  readonly name: string;

  constructor(
    protected validators: readonly T[], 
  ) {
    this.name = this.constructor.name;
  }

  async export() {
    return this.validators;
  }

  async import(data: Input<T>): Promise<Output<T>> {
    let error: any;
    const validated = await firstAsync(
      this.validators as T[], 
      async (el) => {
        try {
          return await el.import(data);
        } catch (err) {
          if (!error) {
            error = err;
          }
        }
      }
    );
    if (!validated) {
      throw error;
    }
    return validated as any;
  }

  static import<T extends GenericImporter>(
    input: T[] | Multi<T>
  ) {
    return input instanceof Multi
      ? input
      : new Multi(input);
  }
}

Serializer.declare(Multi);
