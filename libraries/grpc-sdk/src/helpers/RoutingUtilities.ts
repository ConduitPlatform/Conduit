import { RequestHandlers, wrapRouterGrpcFunction } from './wrapRouterFunctions';
import { Indexable, SocketProtoDescription } from '../interfaces';
import path from 'path';
import fs from 'fs';

const protofile_template = `
syntax = "proto3";
package MODULE_NAME.router;

service Router {
 MODULE_FUNCTIONS
}

message RouterRequest {
  string params = 1;
  string path = 2;
  string headers = 3;
  string context = 4;
  string cookies = 5;
}

message RouterResponse {
  string result = 1;
  string redirect = 2;
  repeated Cookie setCookies = 3;
  repeated Cookie removeCookies = 4;
}

message SocketRequest {
  string event = 1;
  string socketId = 2;
  string params = 3;
  string context = 4;
}

message Cookie {
  string name = 1;
  optional string value = 2;
  Options options = 3;
}

message Options {
  bool httpOnly = 1;
  bool secure = 2;
  bool signed = 3;
  int32 maxAge = 4;
  string path = 5;
  string domain = 6;
  string sameSite = 7;
  
}
message SocketResponse {
  string event = 1;
  string data = 2;
  repeated string receivers = 3;
  repeated string rooms = 4;
}
`;

export function constructProtoFile(moduleName: string, paths: SocketProtoDescription[]) {
  const formattedModuleName = getFormattedModuleName(moduleName);
  const protoFunctions = createProtoFunctions(paths);
  let protoFile = protofile_template
    .toString()
    .replace('MODULE_FUNCTIONS', protoFunctions);
  protoFile = protoFile.replace('MODULE_NAME', formattedModuleName);

  const protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
  fs.writeFileSync(protoPath, protoFile);
  return { path: protoPath, name: formattedModuleName, file: protoFile };
}

function getFormattedModuleName(moduleName: string) {
  return moduleName.replace('-', '_');
}

export function wrapFunctionsAsync(functions: { [name: string]: RequestHandlers }): {
  [name: string]: (call: Indexable, callback?: Indexable) => void;
} {
  const modifiedFunctions: {
    [name: string]: (call: Indexable, callback?: Indexable) => void;
  } = {};
  Object.keys(functions).forEach(key => {
    modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key], 'client');
  });
  return modifiedFunctions;
}

export function createProtoFunctions(paths: SocketProtoDescription[]) {
  let protoFunctions = '';

  paths.forEach(r => {
    if (r.hasOwnProperty('events')) {
      protoFunctions += createProtoFunctionsForSocket(r, protoFunctions);
    } else {
      protoFunctions += createProtoFunctionForRoute(r, protoFunctions);
    }
  });

  return protoFunctions;
}

function createProtoFunctionsForSocket(
  path: SocketProtoDescription,
  protoFunctions: string,
) {
  let newFunctions = '';
  const events = JSON.parse(path.events);
  Object.keys(events).forEach(event => {
    const newFunction = createGrpcFunctionName(events[event].grpcFunction);

    if (protoFunctions.indexOf(`rpc ${newFunction}(`) !== -1) {
      return;
    }

    newFunctions += `rpc ${newFunction}(SocketRequest) returns (SocketResponse);\n`;
  });

  return newFunctions;
}

function createProtoFunctionForRoute(path: Indexable, protoFunctions: string) {
  const newFunction = createGrpcFunctionName(path.grpcFunction);

  if (protoFunctions.indexOf(`rpc ${newFunction}(`) !== -1) {
    return '';
  }

  return `rpc ${newFunction}(RouterRequest) returns (RouterResponse);\n`;
}

function createGrpcFunctionName(grpcFunction: string) {
  return grpcFunction.charAt(0).toUpperCase() + grpcFunction.slice(1);
}
