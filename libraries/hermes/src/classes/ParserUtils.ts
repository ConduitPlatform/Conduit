/**
 * Shared utilities for parsing Conduit type definitions
 * Used by SwaggerParser, GraphQlParser, and MCPParser
 */

import { TYPE } from '@conduitplatform/grpc-sdk';

export class ParserUtils {
  /**
   * Check if a field is required based on Conduit conventions
   * - If field has explicit required property, use that value
   * - Simple string types (e.g., 'String') are optional by default
   * - Objects without required field are optional by default
   */
  static isFieldRequired(field: any): boolean {
    if (typeof field === 'string') {
      return false; // Simple type like 'String' is optional
    }

    if (typeof field === 'object' && field !== null) {
      if (field.hasOwnProperty('required')) {
        return field.required === true;
      }
      return false; // No explicit required field means optional
    }

    return false;
  }

  /**
   * Extract the base type from a field definition
   */
  static getBaseType(field: any): TYPE | string | null {
    if (typeof field === 'string') {
      return field as TYPE;
    }

    if (typeof field === 'object' && field !== null && field.type) {
      return field.type;
    }

    return null;
  }

  /**
   * Extract description from a field definition
   */
  static getFieldDescription(field: any): string | undefined {
    if (typeof field === 'object' && field !== null && field.description) {
      return field.description;
    }
    return undefined;
  }

  /**
   * Check if a field is a Relation type
   */
  static isRelationType(field: any): boolean {
    const baseType = ParserUtils.getBaseType(field);
    return baseType === TYPE.Relation || baseType === 'Relation';
  }

  /**
   * Get the model name for a Relation field
   */
  static getRelationModel(field: any): string | null {
    if (typeof field === 'object' && field !== null && field.model) {
      return field.model;
    }
    return null;
  }

  /**
   * Check if a field is an array type
   */
  static isArrayType(field: any): boolean {
    return Array.isArray(field);
  }

  /**
   * Get the first item from an array field for type inference
   */
  static getArrayItemType(field: any): any {
    if (Array.isArray(field) && field.length > 0) {
      return field[0];
    }
    return null;
  }

  /**
   * Check if a field has a type property (ConduitModelField)
   */
  static hasTypeProperty(field: any): boolean {
    return typeof field === 'object' && field !== null && field.hasOwnProperty('type');
  }

  /**
   * Get the required status from a field, considering Conduit conventions
   * This is the canonical way to determine if a field should be required
   */
  static getRequiredStatus(field: any): boolean {
    if (typeof field === 'string') {
      return false; // Simple types like 'String' are optional by default
    }

    if (typeof field === 'object' && field !== null) {
      if (field.hasOwnProperty('required')) {
        return field.required === true;
      }
      return false; // No explicit required field means optional
    }

    return false;
  }
}
