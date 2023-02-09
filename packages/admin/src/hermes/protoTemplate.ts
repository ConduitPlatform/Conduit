const protoRequest = 'AdminRequest';
const protoResponse = 'AdminResponse';
const protoTemplate = `
syntax = "proto3";
package MODULE_NAME.admin;

service Admin {
 MODULE_FUNCTIONS
}

message AdminRequest {
  string params = 1;
  string path = 2;
  string headers = 3;
  string context = 4;
  string cookies = 5;
  string bodyParams = 6;
  string urlParams = 7;
  string queryParams = 8;
}

message AdminResponse {
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

export default {
  request: protoRequest,
  response: protoResponse,
  template: protoTemplate,
};
