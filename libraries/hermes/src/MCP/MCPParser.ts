/**
 * MCP Parser - Converts Conduit types to Zod schemas
 *
 * This parser is intentionally standalone and does NOT extend ConduitParser,
 * unlike SwaggerParser and GraphQlParser. Here's why:
 *
 * ## Architecture Decision
 *
 * ConduitParser was designed for declarative schema formats (Swagger, GraphQL)
 * that separate structure from content:
 * - Swagger: Builds JSON objects with type/properties/required arrays
 * - GraphQL: Builds strings with type definitions and ! markers for required
 *
 * Zod is fundamentally different - it's a programmatic schema builder where:
 * - Types are composed through method chaining: .optional(), .describe()
 * - Optional/required is intrinsic to the type, not a separate property
 * - Each method returns a new type object
 *
 * Example:
 * - Swagger: { type: 'string', required: ['fieldName'] }
 * - GraphQL: 'fieldName: String!'
 * - Zod: z.string() or z.string().optional()
 *
 * The ConduitParser's getType() method expects:
 *   string | { type?: string; $ref?: string; ... }
 *
 * But Zod needs:
 *   z.ZodTypeAny (e.g., z.string(), z.number().optional())
 *
 * Forcing Zod through ConduitParser would require:
 * 1. Building intermediate objects
 * 2. Converting them to Zod types afterward
 * 3. Losing type safety and chaining capabilities
 *
 * ## Benefits of Standalone Implementation
 *
 * 1. **Semantic Correctness**: Direct mapping to Zod's API
 * 2. **Type Safety**: TypeScript verifies schemas at compile time
 * 3. **Performance**: No intermediate object creation
 * 4. **Flexibility**: Easy to add Zod-specific features (.refine(), .transform())
 * 5. **Cleaner Code**: ~175 lines vs 250+ if forced through ConduitParser
 *
 * ## Shared Logic
 *
 * Common field traversal logic is extracted into ParserUtils, which all
 * parsers can use for consistency while maintaining their specific output formats.
 */

import { z } from 'zod';
import {
  ConduitModel,
  ConduitReturn,
  TYPE,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { ParserUtils } from '../classes/index.js';

export interface MCPParseResult {
  [fieldName: string]: z.ZodTypeAny;
}

export class MCPParser {
  private result: MCPParseResult = {};
  /**
   * Extract types from Conduit model/return definition and convert to Zod schema
   */
  extractTypes(
    name: string,
    fields: ConduitModel | ConduitReturn,
    isInput: boolean,
  ): MCPParseResult {
    this.result = {};
    this.result = this.extractTypesInternal(name, fields);
    return this.result;
  }

  /**
   * Map Conduit TYPE enum to Zod schema
   */
  private getZodType(conduitType: TYPE): z.ZodTypeAny {
    switch (conduitType) {
      case TYPE.String:
        return z.string();
      case TYPE.Number:
        return z.number();
      case TYPE.Boolean:
        return z.boolean();
      case TYPE.Date:
        return z.string().datetime().or(z.date());
      case TYPE.ObjectId:
        return z.string();
      case TYPE.JSON:
        return z.record(z.any(), z.any());
      case TYPE.Relation:
        return z.string(); // Relations are represented as ID strings
      default:
        return z.any();
    }
  }

  /**
   * Internal method to extract types from Conduit fields
   */
  private extractTypesInternal(
    name: string,
    fields: ConduitModel | ConduitReturn,
  ): MCPParseResult {
    const result: MCPParseResult = {};

    if (typeof fields === 'string') {
      // Simple type reference
      const zodType = this.getZodType(fields as TYPE);
      result[name] = zodType;
    } else {
      // Object with fields
      for (const fieldName in fields) {
        if (!fields.hasOwnProperty(fieldName)) continue;

        const field = fields[fieldName];
        const zodType = this.parseField(fieldName, field);
        result[fieldName] = zodType;
      }
    }

    return result;
  }

  /**
   * Parse a single field and return its Zod type
   */
  private parseField(fieldName: string, field: any): z.ZodTypeAny {
    const isRequired = ParserUtils.isFieldRequired(field);
    const description = ParserUtils.getFieldDescription(field);

    // Handle string type (simple type) - these are optional by default in Conduit
    if (typeof field === 'string') {
      let zodType = this.getZodType(field as TYPE);
      if (!isRequired) zodType = zodType.optional();
      if (description) zodType = zodType.describe(description);
      return zodType;
    }

    // Handle array type
    if (ParserUtils.isArrayType(field)) {
      return this.parseArrayField(fieldName, field);
    }

    // Handle object type
    if (typeof field === 'object' && field !== null) {
      return this.parseObjectField(fieldName, field);
    }

    // Fallback
    return z.any();
  }

  /**
   * Parse array field
   */
  private parseArrayField(fieldName: string, field: UntypedArray): z.ZodTypeAny {
    if (field.length === 0) {
      return z.array(z.any());
    }

    const firstItem = field[0];
    let itemType: z.ZodTypeAny;

    if (typeof firstItem === 'string') {
      itemType = this.getZodType(firstItem as TYPE);
    } else if (typeof firstItem === 'object' && firstItem !== null) {
      if (firstItem.type) {
        if (firstItem.type === 'Relation') {
          itemType = z.string();
        } else if (typeof firstItem.type === 'string') {
          itemType = this.getZodType(firstItem.type as TYPE);
        } else {
          // Nested object
          const nestedResult = this.extractTypesInternal(fieldName, firstItem.type);
          itemType =
            Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
        }

        // Apply description if present on array item definition
        if (firstItem.description) {
          itemType = itemType.describe(firstItem.description);
        }
      } else {
        // Direct object
        const nestedResult = this.extractTypesInternal(fieldName, firstItem);
        itemType =
          Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
      }
    } else {
      itemType = z.any();
    }

    return z.array(itemType);
  }

  /**
   * Parse object field
   */
  private parseObjectField(fieldName: string, field: any): z.ZodTypeAny {
    const isRequired = ParserUtils.isFieldRequired(field);
    const description = ParserUtils.getFieldDescription(field);

    // Handle field with type property
    if (ParserUtils.hasTypeProperty(field)) {
      let zodType: z.ZodTypeAny;

      if (ParserUtils.isRelationType(field)) {
        zodType = z.string();
      } else if (typeof field.type === 'string') {
        zodType = this.getZodType(field.type as TYPE);
      } else if (Array.isArray(field.type)) {
        zodType = this.parseArrayField(fieldName, field.type);
      } else {
        // Nested object type
        const nestedResult = this.extractTypesInternal(fieldName, field.type);
        zodType =
          Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
      }

      // Apply optional if not required
      if (!isRequired) {
        zodType = zodType.optional();
      }

      // Apply description if present
      if (description) {
        zodType = zodType.describe(description);
      }

      return zodType;
    }

    // Handle direct object
    const nestedResult = this.extractTypesInternal(fieldName, field);
    return Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
  }
}
