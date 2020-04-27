import {InMemoryStore} from "./InMemoryStore";
import ConduitGrpcSdk from "@conduit/grpc-sdk";

if (process.env.CONDUIT_SERVER) {
    new InMemoryStore(new ConduitGrpcSdk(process.env.CONDUIT_SERVER));
} else {
    throw new Error("Conduit server URL not provided");
}


