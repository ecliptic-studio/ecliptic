// Controller handles HTTP related eg. routing, request validation
import { createDatastoreController } from '@server/controllers/ctrl.datastore.create';
import { dropDatastoreController } from '@server/controllers/ctrl.datastore.drop';
import { renameDatastoreController } from '@server/controllers/ctrl.datastore.rename';
import { schemaChangeDatastoreController } from '@server/controllers/ctrl.datastore.schema-change';
import { kysely } from '@server/db';
import { mwAuthGuard } from '@server/mw/mw.auth-guard';
import { jsonError } from '@server/server-helper';
import { Elysia, status, t } from 'elysia';

const createDatastoreSchema = t.Object({
  internalName: t.String({ minLength: 1, maxLength: 255 }),
  provider: t.Union([t.Literal('sqlite')]), // no turso yet
})

const renameDatastoreSchema = t.Object({
  internalName: t.String({ minLength: 1, maxLength: 255 }),
})

const schemaChangeDatastoreSchema = t.Union([
  t.Object({
    type: t.Literal('add-column'),
    table: t.String({ minLength: 1 }),
    column: t.String({ minLength: 1 }),
    db_type: t.Union([
      t.Literal('TEXT'),
      t.Literal('INTEGER'),
      t.Literal('REAL'),
      t.Literal('BLOB')
    ]),
    foreign_key: t.Optional(t.Object({
      table: t.String({ minLength: 1 }),
      column: t.String({ minLength: 1 })
    }))
  }, {title: 'Add column'}),
  t.Object({
    type: t.Literal('drop-column'),
    table: t.String({ minLength: 1 }),
    column: t.String({ minLength: 1 })
  }, {title: 'Drop column'}),
  t.Object({
    type: t.Literal('rename-column'),
    table: t.String({ minLength: 1 }),
    column: t.String({ minLength: 1 }),
    new_name: t.String({ minLength: 1 })
  }, {title: 'Rename column'}),
  t.Object({
    type: t.Literal('rename-table'),
    table: t.String({ minLength: 1 }),
    new_name: t.String({ minLength: 1 })
  }, {title: 'Rename table'}),
  t.Object({
    type: t.Literal('add-table'),
    table: t.String({ minLength: 1 })
  }, {title: 'Add table'}),
  t.Object({
    type: t.Literal('drop-table'),
    table: t.String({ minLength: 1 })
  }, {title: 'Drop table'})
])

export const apiDatastore = new Elysia({
  prefix: '/api/v1/datastore',
  name: 'apiDatastore'
})
  .use(mwAuthGuard)
  .post(
    '',
    async (ctx) => {
      const [result, error] = await createDatastoreController({ session: ctx.session, db: kysely }, ctx.body);
      ctx.set.headers['accept'] = 'application/json'
      if(error) return status(error.statusCode, jsonError(ctx, error))

      return result
    },
    {
      auth: true,
      body: createDatastoreSchema,
      detail: {
        summary: 'Create a new datastore',
        description: 'Creates a new SQLite database in the filesystem and tracks it in the database',
        tags: ['Datastore']
      }
    }
  )
  .patch(
    '/:id',
    async (ctx) => {
      const [result, error] = await renameDatastoreController(
        { session: ctx.session, db: kysely },
        { id: ctx.params.id, internalName: ctx.body.internalName }
      );
      ctx.set.headers['accept'] = 'application/json';
      if (error) return status(error.statusCode ?? 400, jsonError(ctx, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 })
      }),
      body: renameDatastoreSchema,
      detail: {
        summary: 'Rename a datastore',
        description: 'Renames a datastore and updates associated permission targets',
        tags: ['Datastore']
      }
    }
  )
  .patch(
    '/:id/schema',
    async (ctx) => {
      const [result, error] = await schemaChangeDatastoreController(
        { session: ctx.session, db: kysely },
        { id: ctx.params.id, change: ctx.body }
      );
      ctx.set.headers['accept'] = 'application/json';
      if (error) return status(error.statusCode, jsonError(ctx, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 })
      }),
      body: schemaChangeDatastoreSchema,
      detail: {
        summary: 'Modify datastore schema',
        description: 'Modifies the schema of a datastore by adding, dropping, or renaming columns and tables',
        tags: ['Datastore']
      }
    }
  )
  .delete(
    '/:id',
    async (ctx) => {
      const [result, error] = await dropDatastoreController(
        { session: ctx.session, db: kysely },
        { id: ctx.params.id }
      );
      ctx.set.headers['accept'] = 'application/json';
      if (error) return status(error.statusCode, jsonError(ctx, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 })
      }),
      detail: {
        summary: 'Delete a datastore',
        description: 'Deletes a datastore from the filesystem and database',
        tags: ['Datastore']
      }
    }
  );
