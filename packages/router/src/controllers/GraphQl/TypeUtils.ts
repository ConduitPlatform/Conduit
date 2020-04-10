import {ConduitModel, TYPE} from "@conduit/sdk";


export interface ParseResult {
    types: string[];
    nestedTypes: string[];
    relationTypes: string[];
    typeString: string;
    parentResolve: { parentName: string, resolver: (parent: any) => Promise<any> }[]
}

function constructName(parent: string, child: string) {
    let parentName = parent.slice(0, 1).toUpperCase() + parent.slice(1)
    return parentName + child.slice(0, 1).toUpperCase() + child.slice(1)
}

function arrayHandler(name: string, field: string, value: Array<any>) {
    let typeString = '';
    let finalString = ''
    // if array contains simply a type
    if (typeof value[0] === 'string') {
        typeString += field + ': [' + value[0] + ']' + ' ';
    } else if (value[0].type) {
        // if array contains a model
        if (value[0].type === 'Relation') {
            typeString += field + ': ' + value[0].model + (value[0].required ? '!' : '') + ' ';
        } else if (typeof value[0].type == 'string') {
            typeString += field + ': [' + value[0].type + (value[0].required ? '!' : '') + '] ';
        } else if (Array.isArray(value[0].type)) {
            let parseResult = arrayHandler(name, field, value[0].type as Array<any>);
            typeString += parseResult.typeString.slice(0, parseResult.typeString.length - 1) + (value[0].required ? '!' : '') + ' ';
            finalString += parseResult.finalString;
        }
        // if the array has "type" but is an object
        else {
            let nestedName = constructName(name, field);
            typeString += field + ': [' + nestedName + ']' + ' ' + (value[0].required ? '!' : '') + ' ';
            finalString += ' ' + extractTypes(nestedName, value[0].type) + ' '
        }
    }
    // if array contains an object
    else {
        let nestedName = constructName(name, field);
        typeString += field + ': [' + nestedName + ']' + ' ';
        finalString += ' ' + extractTypes(nestedName, value[0]) + ' '
    }
    return {typeString, finalString};
}

export function extractTypes(name: string, fields: ConduitModel | string): string {
    let finalString = '';
    let typeString = ` type ${name} {`;
    if (typeof fields === 'string') {
        typeString += 'result: ' + fields + '!';
    } else {
        for (let field in fields) {
            if (!fields.hasOwnProperty(field)) continue;
            // if field is simply a type
            if (typeof fields[field] === 'string') {
                typeString += field + ': ' + fields[field] + ' ';
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
                            typeString += field + ': ' + (fields[field] as any).model + ((fields[field] as any).required ? '!' : '') + ' ';
                        } else {
                            typeString += field + ': ' + (fields[field] as any).type + ((fields[field] as any).required ? '!' : '') + ' ';
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
                        typeString += field + ': ' + nestedName + ((fields[field] as any).required ? '!' : '') + ' ';
                        finalString += ' ' + extractTypes(nestedName, (fields[field] as any).type) + ' '
                    }
                } else {
                    // object of some kind
                    let nestedName = constructName(name, field);
                    typeString += field + ': ' + nestedName + ' ';
                    finalString += ' ' + extractTypes(nestedName, (fields[field] as any)) + ' '
                }
            }
        }
    }
    typeString += '} \n';
    finalString += typeString
    return finalString;
}

//test
let result = extractTypes('User', {
    name: {
        type: TYPE.String,
        required: false
    },
    testArray: [{type: 'Relation', model: 'User', required: true}],
    testArray2: [{type: 'Relation', model: 'User', required: false}],
    testArray3: [{type: [{type: TYPE.String, required: true}], required: true}],
    likes: {type: [TYPE.String]},
    testObj: {type: {paparia: TYPE.String, poutses: TYPE.Number}, required: true},
    dislikes: {type: [{type: TYPE.Number, required: true}]}, // currently is interpreted as array required, when in reality the value inside is required
    // dislikes2: {type: [{type: TYPE.Number, required: true}], required: true}, //currently not supported properly
    friends: [{username: TYPE.String, age: TYPE.Number, posts: {type: 'Relation', model: 'Posts'}}]
})

console.log(result)
