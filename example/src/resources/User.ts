import { Serializer, Uuid, Email, Text, Word, Schema, State, Resource, Failure, Collection, Multi, ProtoArgSet } from "../../../src";
import { cache, http, postgres, reactor, ws } from "../services";

export class User extends Resource.from({
  id: new Uuid({ type: 'required' }),
  email: new Email({ type: 'required' }),
  password: new Text({ type: 'required' })
}) {
  static count = User.transform(
    (tx) => tx
      .define({
        method: 'get',
        path: '/user/count',
        cacheable: false,
        dependencies: ['/user'],
      })
      .from(new Schema({}))
      .to(State.Response())
      .using(cache.configure({}))
      .using(postgres.configure({}))
      .using(http.configure({}))
      .using(ws.configure({}))
      .using(reactor.configure({})),
    async (input, ctx) => {
      const { rows } = await ctx.trx.query<{ count: number }>(`
        select count(*) as count
        from "user"
      `);

      return State.Ok(String(rows[0]?.count || 0));
    }
  );

  static find = User.transform(
    (tx) => tx
      .define({
        method: 'get',
        path: '/user/:id',
        cacheable: true,
        input: User.schema.pick('id'),
        output: new Multi([User.importer(), Failure]),
      })
      .using(cache.configure({}))
      .using(postgres.configure({}))
      .using(http.configure({
        authorizer: async (client, input) => 
          client === input.data.id,
      }))
      .using(reactor.configure({})),
    async (input, ctx) => {
      const { rows } = await ctx.trx.query(`
        select *
        from "user"
        where id = '${input.data.id}'
      `);

      if (!rows.length) {
        return Failure.NotFound();
      }

      return User.recall(rows[0]);
    }
  );

  static list = User.transform(
    (tx) => tx
      .define({
        method: 'get',
        path: '/user',
        cacheable: false,
        input: new Schema({}),
        output: new Collection(User.importer()),
      })
      .using(cache.configure({}))
      .using(postgres.configure({}))
      .using(http.configure({}))
      .using(reactor.configure({})),
    async (input, ctx) => {
      console.log('input')
      const { rows } = await ctx.trx.query(`
        select *
        from "user"
      `);

      console.log(rows);

      return User.recall(rows);
    }
  );

  static create = User.transform(
    (tx) => tx
      .define({
        method: 'post',
        path: '/user',
        write: true,
        triggers: ['User.create'],
        input:  User.schema
          .omit('id', 'password')
          .extend({ 
            password: new Word({ type: 'required', minLength: 8 }) 
          }),
        output: new Multi([User.importer(), Failure])
      })
      .using(cache.configure({}))
      .using(postgres.configure({}))
      .using(http.configure({}))
      .using(reactor.configure({})),
    async (input, ctx) => {
      const { email, password } = input.data;

      const existing = await User.find({ id: '2cd2d431-25da-48e1-9ca7-3a3f1237f049' }, ctx);

      try {
        const { rows } = await ctx.trx.query(`
          insert into "user" (email, password) 
          values ('${email}', '${password}')
          returning *
        `);

        return User.init(rows[0]);
      } catch (err) {
        return Failure.Conflict();
      }
    }
  );

  static import: (data: ProtoArgSet<typeof User.schema.fields> | User) => Promise<User>; // fix?
}

Serializer.declare(User);
