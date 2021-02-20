import path from "path";
import * as grpc from "grpc";
const protoLoader = require('@grpc/proto-loader');

export function createGrpcClient(url:string, protoFilePath: string, descriptorObject: string){

    var packageDefinition = protoLoader.loadSync(path.resolve(__dirname, protoFilePath), {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });
    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    let objs = descriptorObject.split(".");
    let descObj:any = protoDescriptor;
    objs.forEach((r:string)=>{
        descObj = descObj[r] as any
    });
    return new descObj(url, grpc.credentials.createInsecure(), {
        "grpc.max_receive_message_length": 1024 * 1024 * 100,
        "grpc.max_send_message_length": 1024 * 1024 * 100
    });
}
