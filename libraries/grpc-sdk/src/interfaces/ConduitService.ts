export interface ConduitService {
  readonly protoPath: string;
  readonly protoDescription: string;
  functions: { [p: string]: Function };
}
