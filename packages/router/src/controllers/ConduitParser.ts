import { ConduitModel } from '@quintessential-sft/conduit-commons';

// TODO:
// - Abstract GraphQL stuff into ConduitParser
// - Implement GraphQlParser
// - Test GraphQlParser
// - Implement SwaggerParser
// - Test SwaggerParser

// TODO: Is this GraphQl-specific? Move into class or abstract
function constructName(parent: string, child: string) {
  let parentName = parent.slice(0, 1).toUpperCase() + parent.slice(1);
  return parentName + child.slice(0, 1).toUpperCase() + child.slice(1);
}

export abstract class ConduitParser<ParseResult> {

  protected abstract getType(conduitType: any): string | any;
  protected abstract getInitializedResult(): ParseResult; // provides an (empty) initialized object of generic type ParseResult
  protected constructResolver(result: ParseResult, parent: string, fieldName: string, isRelation?: boolean) {} // overloaded in GraphQlParser

  // TODO: Refactor methods, removing GraphQl specificities
  // extractTypes():
  //  - Choose your poison:
  //    a) result.typeString = this.extractTypesInternal() <-- update the latter to be result type agnostic, fixing the assignment
  //     - pros: extractTypesInternal has to change either way
  //     - cons: we preserve an initializer abstraction (getInitializedResult)
  //    b) make entirely abstract
  //     - pros: can now remove getInitializedResult() abstraction
  //     - cons: this is our entry point, abstraction feels meh
  // addToRelation():
  //  - make entirely abstract
  // arrayHandler():
  //  - return values are GraphQl-return-type-specific
  //  - ... TODO find more
  // extractTypesInternal():
  //  - return values are GraphQl-return-type-specific
  //  - ... TODO find more
  // -----------------------------------------------------
  extractTypes(
    name: string,
    fields: ConduitModel | string,
    _input?: boolean
  ): ParseResult {
    let result = this.getInitializedResult();
    let input = !!_input;
    result.typeString = this.extractTypesInternal(result, input, name, fields); // TODO: GraphQl-return-type-specific assignment. Have extractTypesInternal update the entire result or sth.
    return result;
  }

  private addToRelation(result: ParseResult, name: string) {
    if (result.relationTypes.indexOf(name) === -1) {
      result.relationTypes.push(name);
    }
  }

  private arrayHandler(result: ParseResult, input: boolean, name: string, field: string, value: Array<any>) {
    let typeString = '';
    let finalString = '';
    // if array contains simply a type
    if (typeof value[0] === 'string') {
      typeString += field + ': [' + this.getType(value[0]) + ']' + ' ';
    } else if (value[0].type) {
      // if array contains a model
      if (value[0].type === 'Relation') {
        this.addToRelation(result, value[0].model);
        this.constructResolver(result, name, field, true);
        typeString +=
          field +
          ': [' +
          (input ? 'ID' : value[0].model) +
          ']' +
          (value[0].required ? '!' : '') +
          ' ';
      } else if (typeof value[0].type === 'string') {
        typeString +=
          field +
          ': [' +
          this.getType(value[0].type) +
          (value[0].required ? '!' : '') +
          '] ';
      } else if (Array.isArray(value[0].type)) {
        let parseResult = this.arrayHandler(result, input, name, field, value[0].type as Array<any>);
        typeString +=
          parseResult.typeString.slice(0, parseResult.typeString.length - 1) +
          (value[0].required ? '!' : '') +
          ' ';
        finalString += parseResult.finalString;
      }
      // if the array has "type" but is an object
      else {
        let nestedName = constructName(name, field);
        this.constructResolver(result, name, field);
        typeString +=
          field + ': [' + nestedName + ']' + ' ' + (value[0].required ? '!' : '') + ' ';
        finalString += ' ' + this.extractTypesInternal(result, input, nestedName, value[0].type) + ' ';
      }
    }
    // if array contains an object
    else {
      let nestedName = constructName(name, field);
      this.constructResolver(result, name, field);
      typeString += field + ': [' + nestedName + ']' + ' ';
      finalString += ' ' + this.extractTypesInternal(result, input, nestedName, value[0]) + ' ';
    }
    return { typeString, finalString };
  }

  private extractTypesInternal(result: ParseResult, input: boolean, name: string, fields: ConduitModel | string): string {
    let finalString = '';
    let typeString = ` ${input ? 'input' : 'type'} ${name} {`;
    if (typeof fields === 'string') {
      typeString += 'result: ' + this.getType(fields) + '!';
    } else {
      for (let field in fields) {
        if (!fields.hasOwnProperty(field)) continue;
        // if field is simply a type
        if (typeof fields[field] === 'string') {
          typeString += field + ': ' + this.getType(fields[field]) + ' ';
        }
        // if field is an array
        else if (Array.isArray(fields[field])) {
          let parseResult = this.arrayHandler(result, input, name, field, fields[field] as Array<any>);
          typeString += parseResult.typeString;
          finalString += parseResult.finalString;
        } else if (typeof fields[field] === 'object') {
          // if it has "type" as a property we assume that the value is a string
          if ((fields[field] as any).type) {
            // if type is simply a type
            if (typeof (fields[field] as any).type === 'string') {
              if ((fields[field] as any).type === 'Relation') {
                this.addToRelation(result, (fields[field] as any).model);
                this.constructResolver(result, name, field, true);
                typeString +=
                  field +
                  ': ' +
                  (input ? 'ID' : (fields[field] as any).model) +
                  ((fields[field] as any).required ? '!' : '') +
                  ' ';
              } else {
                typeString +=
                  field +
                  ': ' +
                  this.getType((fields[field] as any).type) +
                  ((fields[field] as any).required ? '!' : '') +
                  ' ';
              }
            }
            // if type is an array
            else if (Array.isArray((fields[field] as any).type)) {
              let parseResult = this.arrayHandler(
                result,
                input,
                name,
                field,
                (fields[field] as any).type as Array<any>
              );
              typeString +=
                parseResult.typeString.slice(0, parseResult.typeString.length - 1) +
                ((fields[field] as any).required ? '!' : '') +
                ' ';
              finalString += parseResult.finalString;
            } else {
              // object of some kind
              let nestedName = constructName(name, field);
              this.constructResolver(result, name, field);
              typeString +=
                field +
                ': ' +
                nestedName +
                ((fields[field] as any).required ? '!' : '') +
                ' ';
              finalString +=
                ' ' + this.extractTypesInternal(result, input, nestedName, (fields[field] as any).type) + ' ';
            }
          } else {
            // object of some kind
            let nestedName = constructName(name, field);
            this.constructResolver(result, name, field);
            typeString += field + ': ' + nestedName + ' ';
            finalString +=
              ' ' + this.extractTypesInternal(result, input, nestedName, fields[field] as any) + ' ';
          }
        }
      }
    }
    typeString += '} \n';
    finalString += typeString;
    return finalString;
  }
}
