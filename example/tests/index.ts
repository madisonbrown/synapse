import { Sdk, HttpRemote, WsRemote } from '../sdk';

const CLIENT_ID = '2cd2d431-25da-48e1-9ca7-3a3f1237f049';

HttpRemote.initialize({ host: 'http://localhost:3000', headers: { 'client_id': CLIENT_ID } });
WsRemote.initialize({ host: `ws://localhost:3001?client_id=${CLIENT_ID}`});

Sdk.Http.User.list({}).then(console.log);
// Sdk.Ws.User.count({}).then(async (sub) => {
//   console.log(sub);
//   sub.onUpdate(async (data) => console.log('update', data))
//   await sub.cancel();
// });

// Sdk.Http.User.create({ email: 'abc@123.com', password: 'abcdefgh' }).then(console.log);
