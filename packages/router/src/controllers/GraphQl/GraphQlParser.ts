import { ConduitParser } from '../ConduitParser';

export interface ResolverDefinition {
  [key: string]: {
    [key: string]: (parent: any) => any;
  };
}

export interface ParseResult {
  relationTypes: string[];
  typeString: string;
  parentResolve: ResolverDefinition;
}

export class GraphQlParser extends ConduitParser<ParseResult> {
  protected getType(conduitType: any) {
    switch (conduitType) {
      case 'String':
        return conduitType;
      case 'Number':
        return 'Number';
      case 'Boolean':
        return conduitType;
      case 'Date':
        return conduitType;
      case 'ObjectId':
        return 'ID';
      case 'JSON':
        return 'JSONObject';
      default:
        return conduitType;
    }
  }

  protected getInitializedResult() {
    return {
      relationTypes: [],
      typeString: '',
      parentResolve: {},
    };
  }

  protected constructResolver(result: ParseResult, parent: string, fieldName: string, isRelation?: boolean) {
    if (!result.parentResolve[parent]) {
      result.parentResolve[parent] = {};
    }
    if (result.parentResolve[parent][fieldName]) return;
    if (isRelation) {
      result.parentResolve[parent][fieldName] = (parentObj: any) => {
        if (Array.isArray(parentObj[fieldName])) {
          if (typeof parentObj[fieldName][0] === 'string') {
            return parentObj[fieldName].map((obj: any) => {
              id: obj;
            });
          }
          return parentObj[fieldName];
        } else {
          if (typeof parentObj[fieldName] === 'string') {
            return { id: parentObj[fieldName] };
          }
          return parentObj[fieldName];
        }
      };
    } else {
      result.parentResolve[parent][fieldName] = (parentObj: any) => {
        return parentObj[fieldName];
      };
    }
  }


}
