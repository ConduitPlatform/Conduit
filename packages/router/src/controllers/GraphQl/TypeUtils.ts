import {ConduitModel} from '@quintessential-sft/conduit-sdk';

const deepdash = require('deepdash/standalone')

export interface ResolverDefinition {
    [key: string]: {
        [key: string]: (parent: any) => any
    }
}


export interface ParseResult {
    relationTypes: string[];
    typeString: string;
    parentResolve: ResolverDefinition;
}


export function findPopulation(fields: any, relations: string[]): string[] | undefined {
    if (relations.length === 0) return undefined;
    let result: string[] = [];
    deepdash.eachDeep(fields, (value: any, key: any, parent: any, context: any) => {
        if (value.fieldsByTypeName) {
            let keys = Object.keys(value.fieldsByTypeName);
            if (keys.length > 0 && relations.indexOf(keys[0]) !== -1 && result.indexOf(key) === -1) {
                result.push(key);
            }
        }
    });

    return result;

}

function constructName(parent: string, child: string) {
    let parentName = parent.slice(0, 1).toUpperCase() + parent.slice(1)
    return parentName + child.slice(0, 1).toUpperCase() + child.slice(1)
}

function getGraphQLType(conduitType: any) {
    switch (conduitType) {
        case 'String':
            return conduitType;
        case 'Number':
            return 'Int';
        case 'Boolean':
            return conduitType;
        case  'Date':
            return conduitType;
        case 'ObjectId':
            return 'ID';
        case  'JSON':
            return 'JsonObject';
        default:
            return conduitType;
    }

}


export function extractTypes(name: string, fields: ConduitModel | string, _input?: boolean): ParseResult {

    let result: ParseResult = {
        relationTypes: [],
        typeString: '',
        parentResolve: {}
    }
    let input = !!_input;

    function addToRelation(name: string) {
        if (result.relationTypes.indexOf(name) === -1) {
            result.relationTypes.push(name);
        }
    }

    function constructResolver(parent: string, fieldName: string, isRelation?: boolean) {
        if (!result.parentResolve[parent]) {
            result.parentResolve[parent] = {};
        }
        if (result.parentResolve[parent][fieldName]) return;
        if (isRelation) {
            result.parentResolve[parent][fieldName] = (parentObj: any) => {
                if (Array.isArray(parentObj[fieldName])) {
                    if (typeof parentObj[fieldName][0] === 'string') {
                        return parentObj[fieldName].map((obj: any) => {
                            id: obj
                        });
                    }
                    return parentObj[fieldName];
                } else {
                    if (typeof parentObj[fieldName] === 'string') {
                        return {id: parentObj[fieldName]}
                    }
                    return parentObj[fieldName]
                }
            };
        } else {
            result.parentResolve[parent][fieldName] = (parentObj: any) => {
                return parentObj[fieldName];
            };
        }

    }

    function arrayHandler(name: string, field: string, value: Array<any>) {
        let typeString = '';
        let finalString = ''
        // if array contains simply a type
        if (typeof value[0] === 'string') {
            typeString += field + ': [' + getGraphQLType(value[0]) + ']' + ' ';
        } else if (value[0].type) {
            // if array contains a model
            if (value[0].type === 'Relation') {
                addToRelation(value[0].model);
                constructResolver(name, field, true);
                typeString += field + ': ' + value[0].model + (value[0].required ? '!' : '') + ' ';
            } else if (typeof value[0].type === 'string') {
                typeString += field + ': [' + getGraphQLType(value[0].type) + (value[0].required ? '!' : '') + '] ';
            } else if (Array.isArray(value[0].type)) {
                let parseResult = arrayHandler(name, field, value[0].type as Array<any>);
                typeString += parseResult.typeString.slice(0, parseResult.typeString.length - 1) + (value[0].required ? '!' : '') + ' ';
                finalString += parseResult.finalString;
            }
            // if the array has "type" but is an object
            else {
                let nestedName = constructName(name, field);
                constructResolver(name, field);
                typeString += field + ': [' + nestedName + ']' + ' ' + (value[0].required ? '!' : '') + ' ';
                finalString += ' ' + extractTypesInternal(nestedName, value[0].type) + ' '
            }
        }
        // if array contains an object
        else {
            let nestedName = constructName(name, field);
            constructResolver(name, field);
            typeString += field + ': [' + nestedName + ']' + ' ';
            finalString += ' ' + extractTypesInternal(nestedName, value[0]) + ' '
        }
        return {typeString, finalString};
    }

    function extractTypesInternal(name: string, fields: ConduitModel | string): string {
        let finalString = '';
        let typeString = ` ${input ? 'input' : 'type'} ${name} {`;
        if (typeof fields === 'string') {
            typeString += 'result: ' + getGraphQLType(fields) + '!';
        } else {
            for (let field in fields) {
                if (!fields.hasOwnProperty(field)) continue;
                // if field is simply a type
                if (typeof fields[field] === 'string') {
                    typeString += field + ': ' + getGraphQLType(fields[field]) + ' ';
                }
                // if field is an array
                else if (Array.isArray(fields[field])) {
                    let parseResult = arrayHandler(name, field, fields[field] as Array<any>);
                    typeString += parseResult.typeString;
                    finalString += parseResult.finalString;
                } else if (typeof fields[field] === 'object') {
                    // if it has "type" as a property we assume that the value is a string
                    if ((fields[field] as any).type) {
                        // if type is simply a type
                        if (typeof (fields[field] as any).type === 'string') {
                            if ((fields[field] as any).type === 'Relation') {
                                addToRelation((fields[field] as any).model);
                                constructResolver(name, field, true);
                                typeString += field + ': ' + (fields[field] as any).model + ((fields[field] as any).required ? '!' : '') + ' ';
                            } else {
                                typeString += field + ': ' + getGraphQLType((fields[field] as any).type) + ((fields[field] as any).required ? '!' : '') + ' ';
                            }
                        }
                        // if type is an array
                        else if (Array.isArray((fields[field] as any).type)) {
                            let parseResult = arrayHandler(name, field, (fields[field] as any).type as Array<any>);
                            typeString += parseResult.typeString.slice(0, parseResult.typeString.length - 1) + ((fields[field] as any).required ? '!' : '') + ' ';
                            finalString += parseResult.finalString;
                        } else {
                            // object of some kind
                            let nestedName = constructName(name, field);
                            constructResolver(name, field);
                            typeString += field + ': ' + nestedName + ((fields[field] as any).required ? '!' : '') + ' ';
                            finalString += ' ' + extractTypesInternal(nestedName, (fields[field] as any).type) + ' '
                        }
                    } else {
                        // object of some kind
                        let nestedName = constructName(name, field);
                        constructResolver(name, field);
                        typeString += field + ': ' + nestedName + ' ';
                        finalString += ' ' + extractTypesInternal(nestedName, (fields[field] as any)) + ' '
                    }
                }
            }
        }
        typeString += '} \n';
        finalString += typeString
        return finalString;
    }

    result.typeString = extractTypesInternal(name, fields);

    return result;
}

//test
// let result = extractTypes('User', {
//     name: ConduitNumber.Required,
//     testArray: [{type: 'Relation', model: 'User', required: true}],
//     testArray2: [{type: 'Relation', model: 'User', required: false}],
//     testArray3: [{type: [{type: TYPE.String, required: true}], required: true}],
//     likes: {type: [TYPE.String]},
//     testObj: {type: {paparia: TYPE.String, poutses: TYPE.Number}, required: true},
//     dislikes: {type: [{type: TYPE.Number, required: true}]}, // currently is interpreted as array required, when in reality the value inside is required
//     // dislikes2: {type: [{type: TYPE.Number, required: true}], required: true}, //currently not supported properly
//     friends: [{username: TYPE.String, age: TYPE.Number, posts: {type: 'Relation', model: 'Posts'}}]
// })
// console.log(result)
