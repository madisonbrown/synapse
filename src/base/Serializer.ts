import { Exception } from "./Exception";

export type Exportable<O extends SerializableData> = { 
  export(): O | Promise<O> 
};
export type Importer<O extends GenericExportable, I = any> = { 
  name: string;
  import(data: I): O | Promise<O>;
};
export type GenericExportable = Exportable<SerializableData>;
export type GenericImporter = Importer<GenericExportable>;
export type Input<T extends GenericImporter> = Parameters<T['import']>[0];
export type Output<T extends GenericImporter> = Awaited<ReturnType<T['import']>>;

type Primitive = string | number | boolean | null | undefined;
type SerializableData = Primitive 
  | Exportable<any>
  | Importer<any>
  | SerializableData[] 
  | readonly SerializableData[] 
  | { [key: string]: SerializableData };

type Exported = {
  name?: string
  data?: Primitive
    | Exported
    | Exported[]
    | { [key: string]: Exported }; 
};

type Handler<T> = (
  node: Exported, 
  type: 'primitive' | 'array' | 'object' | 'exportable' | 'importer',
) => T;

const getClassName = (obj: any): string | undefined => {
  const isClass = 'name' in obj && obj.constructor === Function;
  return isClass ? obj.name : obj.constructor?.name;
}
const assertImportable = (data: Exported['data']): Exported => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw Serializer.Error.BAD_SERIALIZATION(`Invalid data\n\n${JSON.stringify(data)}`);
  }
  return data;
}

export class Serializer {
  static Error = Exception.group({
    UNDECLARED_TYPE: (description: string = '') => ({ message: `Undeclared type: ${description}` }),
    BAD_SERIALIZATION: (description: string = '') => ({ message: `Bad serialization: ${description}` })
  });

  private static map = new Map<string, GenericImporter>();

  private static async export<T>(
    data: SerializableData, 
    handler: Handler<T>,
    transform?: (node: SerializableData) => SerializableData,
  ): Promise<T> {
    const _data = transform ? transform(data) : data;

    if (
      _data === undefined 
        || _data === null 
        || typeof _data === 'string' 
        || typeof _data === 'number' 
        || typeof _data === 'boolean'
    ) {
      return handler({ data: _data }, 'primitive');
    }

    if (Array.isArray(_data)) {
      const result = await Promise.all(
        _data.map((node) => Serializer.export(node, handler, transform))
      );
      return handler({ data: result as Exported[] }, 'array');
    }

    if (_data.constructor === Object.prototype.constructor) {
      const result: any = {};
      await Promise.all(
        Object.entries(_data).map(async ([key, node]) => {
          const val = await Serializer.export(node, handler, transform);
          if (val !== undefined) {
            result[key] = val;
          }
        })
      );
      return handler({ data: result }, 'object');
    }
    
    const name = getClassName(_data);

    if (!name || !this.map.has(name)) {
      throw Serializer.Error.UNDECLARED_TYPE(name);
    }

    try {
      if ('export' in _data && typeof _data.export === 'function') {
        const result = await Serializer.export(await _data.export(), handler, transform);
        return handler({ name, data: result as Exported }, 'exportable');
      }

      return handler({ name },'importer');
    } catch (error) {
      throw Serializer.Error.BAD_SERIALIZATION(`Error while attempting to export object of type '${name}'\n\n${error}`);
    }
  }

  private static async import(value: Exported): Promise<SerializableData> {
    const { name, data } = assertImportable(value);

    if (name) {
      const Type = this.map.get(name);

      if (!Type) {
        throw Serializer.Error.UNDECLARED_TYPE(name);
      }

      if (data === undefined) {
        return Type;
      }
  
      try {
        return Type.import(await Serializer.import(assertImportable(data)));
      } catch (error) {
        throw Serializer.Error.BAD_SERIALIZATION(`Error while attempting to import object of type '${name}'\n\n${error}`);
      }
    }

    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return Promise.all(data.map(Serializer.import));
    }

    const result: any = {};
    await Promise.all(
      Object.entries(data).map(async ([key, val]) => {
        result[key] = await Serializer.import(assertImportable(val));
      })
    );
    return result;
  }

  static async serialize(data: SerializableData): Promise<string> {
    return JSON.stringify(await Serializer.export(data, (node) => node));
  }

  static async deserialize(value: string): Promise<SerializableData> {
    return Serializer.import(JSON.parse(value));
  }

  static async compile(
    data: any,
    options: {
      sourcePath: string, 
      exportAs: string,
      transform?: (node: SerializableData) => SerializableData,
    }
  ): Promise<string> {
    const { sourcePath, exportAs, transform } = options;
    const dependencies = new Set<string>();
    const initialization = await Serializer.export(
      data, 
      ({ name, data: value }, type) => {
        switch (type) {
          case 'primitive':
            if (value === undefined) {
              return JSON.stringify(value); // fix
            } else {
              return `${JSON.stringify(value)} as const`;
            }
          case 'array':
            if (Array.isArray(value)) {
              return `[${value.join(',')}]`;
            }
          case 'object':
            if (value && typeof value === 'object') {
              return `{${Object.entries(value)
                .map(([key, val]) => `"${key}":${val}`)
                .join(',')}}`;
            }
          case 'exportable':
            if (name && value) {
              dependencies.add(name);
              return `${name}.import(${value})`;
            }
          case 'importer':
            if (name) {
              dependencies.add(name);
              return name;
            }
          default:
            return '';
        }
      }, 
      transform,
    );
    
    return `import {${Array.from(dependencies).join(',')}} from '${sourcePath}';\nexport const ${exportAs} = ${initialization};\nexport {${Array.from(dependencies).join(',')}}\n`;
  }

  static declare<T extends GenericImporter>(Type: T) {
    Serializer.map.set(Type.name, Type);
  }
}
