export type ExceptionData = {
  type: string;
  message?: string;
};

export class Exception<T extends ExceptionData> extends Error {
  readonly name: string;
  protected _data: T;

  protected constructor(data: T) {
    super(data.message);
    (this as any).__proto__ = new.target.prototype; 
    this.name = this.constructor.name;
    this._data = data;
  }

  get data() {
    return { ...this._data };
  }

  static group<
    T extends { [key: string]: (...args: any) => Omit<ExceptionData, 'type'> }
  >(
    types: T
  ): { 
    [P in keyof T]: P extends string 
      ? (...args: Parameters<T[P]>) => Exception<{ type: P } & ReturnType<T[P]>> 
      : never 
  } {
    const result: any = {};

    Object.keys(types).forEach((type) => {
      result[type] = (...args: any) => new Exception({ ...types[type](...args), type })
    })

    return result;
  }

  static handle<
    T extends ReturnType<typeof Exception.group>, 
    U extends Partial<{ [P in keyof T]: (err: ReturnType<T[P]>) => any }>
  >(
    group: T, 
    err: any, 
    handlers: U
  ): U[keyof T] extends (...args: any[]) => any ? ReturnType<U[keyof T]> : never {
    if (err instanceof Exception) {
      const handler = handlers[err._data.type as keyof T];

      if (handler) {
        return handler(err as any);
      }
    }
    
    throw err;
  }
}
