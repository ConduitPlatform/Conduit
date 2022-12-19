import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database;
    console.log('Executed up function!');
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database;
    console.log('Executed down function!');
  },
};
