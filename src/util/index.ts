export type UnionToIntersection<U> = (U extends any ? (key: U) => void : never) extends ((key: infer I) => void) ? I : never;

export type OneOrMore<T> = T | readonly T[];
export type OneOf<T> = T extends readonly any[] ? T[number] : T;

export type Values<T> = T[keyof T];
export type Clean<T> = Pick<T, { [P in keyof T]: T[P] extends never ? never : P }[keyof T]>;
export type Flatten<T, U> = T extends U ? U : T extends object ? Values<{ [P in keyof T]: Flatten<T[P], U> }> : never;
export type Has<T, U> = U extends Flatten<T, U> ? true : false;

export type Subtract<T, U> = Omit<T, keyof (T | U)> & Clean<{
  [P in keyof (T | U)]: U[P] extends T[P] ? never : T[P]
}>;

export const HttpStatus = '$status';

export const toJsonDeterministic = (data: any) => {
  const keys: string[] = [];
  const seen: { [key: string]: any } = {};

  JSON.stringify(data, (key, value) => {
    if (!(key in seen)) {
      keys.push(key);
      seen[key] = null;
    }
    return value; // fix: sort arrays?
  });

  keys.sort();

  return JSON.stringify(data, keys);
};

export const routeToPath = (route: string, args: any): { path: string, args: any } => {
  const _args = { ...args };
  const _path = route.replace(/:([^\/]*)/g, (match, key) => {
    const result = _args[key] || '';
    delete _args[key];
    return result;
  });
  return { path: _path, args: _args };
};
  
export const first = <T, U>(arr: T[], fn: (el: T) => U | undefined) => {
  let result: U | undefined;
  arr.filter((el) => result = fn(el));
  return result;
}

export const firstAsync = <T, U>(arr: T[], fn: (el: T) => Promise<U | undefined>) => {
  return arr.reduce(
    async (prev, el) => await prev || await fn(el), 
    Promise.resolve(undefined as U | undefined)
  );
}

export const pick = <T extends {}, U extends keyof T>(
  from: T,
  keys: U[],
) => {
  return keys.reduce((res, key) => {
    res[key] = from[key];
    return res;
  }, {} as Partial<T>) as Pick<T, U>;
};
