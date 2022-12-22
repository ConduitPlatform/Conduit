import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { isBoolean } from 'lodash';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

// export async function migrateCrudOperations(
//   adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
// ) {
//   const model = adapter.getSchemaModel('_DeclaredSchema').model;
//   const declaredSchemas = await model.findMany({});
//   const cmsSchemas = declaredSchemas.filter((schema: ConduitSchema) =>
//     isBoolean(schema.modelOptions.conduit?.cms),
//   );
//   for (const schema of cmsSchemas) {
//     const { crudOperations, authentication, enabled } = schema.modelOptions.conduit.cms;
//     const cms = {
//       enabled: enabled,
//       crudOperations: {
//         create: {
//           enabled: crudOperations,
//           authenticated: authentication,
//         },
//         read: {
//           enabled: crudOperations,
//           authenticated: authentication,
//         },
//         update: {
//           enabled: crudOperations,
//           authenticated: authentication,
//         },
//         delete: {
//           enabled: crudOperations,
//           authenticated: authentication,
//         },
//       },
//     };
//     const id = schema._id.toString();
//     await model.findByIdAndUpdate(id, {
//       modelOptions: {
//         conduit: { cms },
//       },
//     });
//   }
// }

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const query = {
      mongoQuery: {
        find: {},
      },
      sqlQuery: {
        query: 'SELECT * FROM "cnd_DeclaredSchema"',
      },
    };
    const declaredSchemas = await database.rawQuery('_DeclaredSchema', query);
    const cmsSchemas = declaredSchemas.filter((schema: ConduitSchema) =>
      isBoolean(schema.modelOptions.conduit?.cms),
    );
    for (const schema of cmsSchemas) {
      const { crudOperations, authentication, enabled } = schema.modelOptions.conduit.cms;
      const cms = {
        enabled: enabled,
        crudOperations: {
          create: {
            enabled: crudOperations,
            authenticated: authentication,
          },
          read: {
            enabled: crudOperations,
            authenticated: authentication,
          },
          update: {
            enabled: crudOperations,
            authenticated: authentication,
          },
          delete: {
            enabled: crudOperations,
            authenticated: authentication,
          },
        },
      };
      const modelOptions = { conduit: { cms } };
      const query = {
        mongoQuery: {
          updateOne: { _id: schema._id.toString() },
          options: {
            $set: { modelOptions: modelOptions },
          },
        },
        sqlQuery: {
          query: `UPDATE "cnd_DeclaredSchema" SET "modelOptions" = ${modelOptions} WHERE _id = '${schema._id}'`,
        },
      };
      await database.rawQuery('_DeclaredSchema', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
