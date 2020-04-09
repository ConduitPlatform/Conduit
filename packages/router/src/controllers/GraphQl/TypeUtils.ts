import {ConduitModel, TYPE} from "@conduit/sdk";

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
                // if array contains simply a type
                if (typeof (fields[field] as Array<any>)[0] === 'string') {
                    typeString += field + ': [' + (fields[field] as Array<any>)[0] + ']' + ' ';
                } else if ((fields[field] as Array<any>)[0].type) {
                    // if array contains a model
                    if (typeof (fields[field] as Array<any>)[0].type == 'string') {
                        typeString += field + ': [' + (fields[field] as Array<any>)[0].type + ']' + ((fields[field] as Array<any>)[0].required ? '!' : '') + ' ';
                    }
                    // if the array has "type" but is an object
                    else {
                        let nestedName = field.slice(0, 1).toUpperCase() + field.slice(1);
                        typeString += field + ': [' + (name + nestedName) + ']' + ' ' + ((fields[field] as Array<any>)[0].required ? '!' : '') + ' ';
                        finalString += ' ' + extractTypes((name + nestedName), (fields[field] as Array<any>)[0].type) + ' '
                    }
                }
                // if array contains an object
                else {
                    let nestedName = field.slice(0, 1).toUpperCase() + field.slice(1);
                    typeString += field + ': [' + (name + nestedName) + ']' + ' ';
                    finalString += ' ' + extractTypes((name + nestedName), (fields[field] as Array<any>)[0]) + ' '
                }
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
                        // if the array includes a simple type
                        if (typeof ((fields[field] as any).type as Array<any>)[0] === 'string') {
                            typeString += field + ': [' + (fields[field] as Array<any>)[0] + ']' + ((fields[field] as any).required ? '!' : '') + ' ';
                        }
                        // if the array contains an object
                        else {
                            let nestedName = field.slice(0, 1).toUpperCase() + field.slice(1);
                            typeString += field + ': [' + (name + nestedName) + ']' + ((fields[field] as any).required ? '!' : '') + ' ';
                            finalString += ' ' + extractTypes((name + nestedName), ((fields[field] as any).type as Array<any>)[0]) + ' '
                        }
                    } else {
                        // object of some kind
                        let nestedName = field.slice(0, 1).toUpperCase() + field.slice(1);
                        typeString += field + ': [' + (name + nestedName) + ']' + ((fields[field] as any).required ? '!' : '') + ' ';
                        finalString += ' ' + extractTypes((name + nestedName), (fields[field] as any).type) + ' '
                    }

                } else {
                    // object of some kind
                    let nestedName = field.slice(0, 1).toUpperCase() + field.slice(1);
                    typeString += field + ': ' + (name + nestedName) + ' ';
                    finalString += ' ' + extractTypes((name + nestedName), (fields[field] as any)) + ' '
                }
            }
        }
    }
    typeString += '} \n';
    finalString += typeString
    return finalString;
}

//test
// let result = extractTypes('User', {
//     name: {
//         type: TYPE.String,
//         required: false
//     },
//     friends: [{username: TYPE.String, age: TYPE.Number, posts: {type: 'Relation', model:'Posts'}}]
// })
//
// console.log(result)
