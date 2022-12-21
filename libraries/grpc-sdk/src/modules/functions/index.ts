import { ConduitModule } from '../../classes/ConduitModule';
import { FunctionsDefinition } from '../../protoUtils/functions';

export class Functions extends ConduitModule<typeof FunctionsDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'functions', url, grpcToken);
    this.initializeClient(FunctionsDefinition);
  }

  uploadFunction(name: string, code: string, operation: string) {
    return this.client!.uploadFunction({ name, code, operation }).then(res => {
      return { name: res.name, code: res.code, operation: res.operation };
    });
  }

  executeFunction(name: string) {
    return this.client!.executeFunction({ name }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteFunction(id: string) {
    return this.client!.deleteFunction({ id }).then(res => {
      return JSON.parse(res.message);
    });
  }

  getFunction(id: string) {
    return this.client!.getFunction({ id }).then(res => {
      return { name: res.name, code: res.code, operation: res.operation };
    });
  }

  listFunctions(
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
  ): Promise<
    {
      name: string;
      code: string;
      operation: string;
    }[]
  > {
    const srt = sort ? JSON.stringify(sort) : undefined;
    return this.client!.getFunctions({ skip, limit, sort: srt }).then(res => {
      return res.functions.map(
        (func: { name: string; code: string; operation: string }) => {
          return {
            name: func.name,
            code: func.code,
            operation: func.operation,
          };
        },
      );
    });
  }

  updateFunction(id: string, name: string, code: string, operation: string) {
    return this.client!.updateFunction({ id, name, code, operation }).then(res => {
      return { name: res.name, code: res.code, operation: res.operation };
    });
  }
}
