import * as fs from 'fs';
import * as path from 'path';
import { Serializer, Resource, State, HttpRemote, WsRemote } from '../../src';
import { Services } from '../src/index';

Serializer.compile(
  {
    Http: Services.http.tree.map((node) => {
      const { input, output } = node.properties;
      return HttpRemote.import({
        method: node.method,
        path: node.path,
        input,
        output,
      });
    }).nodes,
    Ws: Services.ws.tree.map((node, namespace) => {
      const { input, output } = node.properties;
      return WsRemote.import({
        name: namespace.join('.'), // fix
        input, 
        output,
      });
    }).nodes,
  }, 
  {
    sourcePath: './common', 
    exportAs: 'Sdk', 
    transform: (node: any) => node.prototype instanceof Resource
      ? new State(node.schema)
      : node,
  }
).then(async (result) => {
  await fs.promises.writeFile(
    path.resolve(__dirname, '../sdk/index.ts'),
    result,
  );

  console.log('compiled');
  process.exit(0); // fix
});
