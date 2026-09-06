/**
 * Shared utilities for parsing Conduit type definitions
 * Used by SwaggerParser, GraphQlParser, and ZodParser
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
   * True for TYPE.Vector / 'Vector'. Never treat this as a named schema/reference.
   */
  static isVectorTypeName(value: unknown): boolean {
    return value === TYPE.Vector || value === 'Vector';
  }

  /**
   * Check if a field is a Vector type (shorthand or object form).
   */
  static isVectorType(field: unknown): boolean {
    return ParserUtils.isVectorTypeName(ParserUtils.getBaseType(field));
  }

  /**
   * Positive integer dimensions from a Vector field (or a raw dimensions value).
   */
  static getVectorDimensions(fieldOrDimensions: unknown): number | undefined {
    const value =
      typeof fieldOrDimensions === 'number'
        ? fieldOrDimensions
        : typeof fieldOrDimensions === 'object' &&
            fieldOrDimensions !== null &&
            'dimensions' in fieldOrDimensions
          ? (fieldOrDimensions as { dimensions?: unknown }).dimensions
          : undefined;
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    return undefined;
  }

  /**
   * OpenAPI/Swagger: constrain a numeric array to the Vector field's dimensions.
   */
  static applyVectorOpenApiConstraints(
    schema: Record<string, unknown>,
    sourceField?: unknown,
  ): void {
    if (schema.type !== 'array') return;
    const dimensions = ParserUtils.getVectorDimensions(sourceField);
    if (dimensions === undefined) return;
    schema.minItems = dimensions;
    schema.maxItems = dimensions;
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
