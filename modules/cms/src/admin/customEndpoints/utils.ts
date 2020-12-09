import {TYPE} from "@quintessential-sft/conduit-grpc-sdk";
import {isNil} from "lodash";

/**
 * Query schema:
 * {
 * name: String,
 * type: String that is inside the TYPE enum of the sdk
 * location: String (Body, queryParams, url)
 * }
 */
export function queryValidation(findSchema: any, inputs: any, schemaField: string, operation: number, comparisonField: any) {

    if (isNil(schemaField) || isNil(operation) || isNil(comparisonField)) {
        return "schemaField, operation and comparisonField must be present in the input"
    }
    if (schemaField.length === 0) {
        return "schemaField cannot be empty";
    }

    if (Object.keys(comparisonField).length === 0 || isNil(comparisonField.type) || isNil(comparisonField.value)) {
        return "comparisonField cannot be empty and should contain type and value";
    }

    if (!Object.keys(findSchema.fields).includes(schemaField)) {
        return "schemaField is not present in selected schema!";
    }

    if (operation < 0 || operation > 10) {
        return "operation is invalid!";
    }

    if (comparisonField.type === 'Schema') {
        if (!Object.keys(findSchema).includes(comparisonField.value)) {
            return "comparisonField value is not present in selected schema!";
        }
    } else if (comparisonField.type === 'Input') {
        let inputNames = inputs.map((r: any) => r.name);
        if (!inputNames.includes(comparisonField.value)) {
            return "comparisonField value is not present in provided inputs!";
        }
    } else if (comparisonField.type !== 'Custom') {
        return "comparisonField type is invalid!";
    }
    return true;
}

/**
 * Input schema:
 * {
 * name: String,
 * type: String that is inside the TYPE enum of the sdk
 * location: String (Body, queryParams, url)
 * }
 */
export function inputValidation(name: string, type: any, location: number): boolean | string {
    if (isNil(name) || isNil(type) || isNil(location)) {
        return "Name, type and location must be present in the input"
    }
    if (name.length === 0) {
        return "Name cannot be empty";
    }
    if (type.length === 0) {
        return "Type cannot be empty";
    }
    
    if (!Object.values(TYPE).includes(type)) {
        return "Type is not valid!";
    }

    if (location < 0 || location  >2) {
        return "Location is not valid!";
    }
    return true;
}

/**
 * Assignment schema:
 * {
 * schemaField: String
 * action: Number
 * assignmentField: {type: String, value: String}
 * }
 */
export function assignmentValidation(
    findSchema: any,
    inputs: any,
    operation: number,
    schemaField: string,
    assignmentField: any,
    action: number
): boolean | string {
    if (isNil(schemaField) || isNil(assignmentField) || isNil(action)) {
        return "schemaField, assignmentField and action must be present in the input";
    }
    if (schemaField.length === 0) {
        return "schemaField cannot be empty";
    }

    if (action < 0 || action > 4) {
        return "action is invalid!";
    }

    // action are available only for PUT (update) operations
    if (operation !== 2 && action !== 0) {
        return "action is invalid";
    }

    if (Object.keys(assignmentField).length === 0 || isNil(assignmentField.type) || isNil(assignmentField.value)) {
        return "assignmentField cannot be empty and should contain type and value";
    }

    if (!Object.keys(findSchema.fields).includes(schemaField)) {
        return "schemaField is not present in selected schema!";
    }

    if (assignmentField.type === 'Input') {
        let inputNames = inputs.map((r: any) => r.name);
        if (!inputNames.includes(assignmentField.value)) {
            return "assignmentField value is not present in provided inputs!";
        }
    }
    else if (assignmentField.type !== 'Custom') {
        return "assignmentField type is invalid!";
    }

    if (action === 3 || action === 4) {
        if (findSchema.fields[schemaField].type !== 'Array') {
            return "append and remove actions are valid only for array schema fields";
        }
    }

    return true;
}
