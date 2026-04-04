/**
 * Zod Parser — converts Conduit field definitions to Zod schemas.
 *
 * Standalone (does not extend ConduitParser). Shared by REST validation, GraphQL, and MCP tools.
 * Shared field inspection lives in ParserUtils.
 */

import { z } from 'zod';
import {
  ConduitModel,
  ConduitReturn,
  TYPE,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { ParserUtils } from './ParserUtils.js';

export interface ZodParseResult {
  [fieldName: string]: z.ZodTypeAny;
}

export class ZodParser {
  private result: ZodParseResult = {};
  private useCoercion = false;

  extractTypes(
    name: string,
    fields: ConduitModel | ConduitReturn,
    _isInput: boolean,
  ): ZodParseResult {
    this.result = {};
    this.result = this.extractTypesInternal(name, fields);
    return this.result;
  }

  buildZodSchema(
    params: Record<string, unknown>,
    options: { strict?: boolean; coerce?: boolean } = {},
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const { strict = true, coerce = false } = options;
    const prevCoerce = this.useCoercion;
    try {
      if (coerce) this.useCoercion = true;
      const fields = this.extractTypes('params', params as ConduitModel, true);
      const schema = z.object(fields);
      return strict ? schema.strict() : schema.passthrough();
    } finally {
      this.useCoercion = prevCoerce;
    }
  }

  private applyValidation(
    zodType: z.ZodTypeAny,
    field: Record<string, unknown>,
  ): z.ZodTypeAny {
    const validate = field?.validate as Record<string, unknown> | undefined;
    if (!validate) return zodType;

    if (zodType instanceof z.ZodString) {
      let s = zodType as z.ZodString;
      if (validate.format === 'email') s = s.email();
      if (validate.format === 'url') s = s.url();
      if (validate.format === 'uuid') s = s.uuid();
      if (validate.format === 'objectId')
        s = s.regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');
      if (validate.minLength != null) s = s.min(validate.minLength as number);
      if (validate.maxLength != null) s = s.max(validate.maxLength as number);
      if (validate.length != null) s = s.length(validate.length as number);
      if (validate.pattern) s = s.regex(new RegExp(validate.pattern as string));
      return s;
    }

    if (zodType instanceof z.ZodNumber) {
      let n = zodType as z.ZodNumber;
      if (validate.min != null) n = n.gte(validate.min as number);
      if (validate.max != null) n = n.lte(validate.max as number);
      if (validate.exclusiveMin != null) n = n.gt(validate.exclusiveMin as number);
      if (validate.exclusiveMax != null) n = n.lt(validate.exclusiveMax as number);
      if (validate.integer) n = n.int();
      return n;
    }

    return zodType;
  }

  private getZodType(conduitType: TYPE): z.ZodTypeAny {
    switch (conduitType) {
      case TYPE.String:
        return z.string();
      case TYPE.Number:
        return this.useCoercion ? z.coerce.number() : z.number();
      case TYPE.Boolean:
        return this.useCoercion ? z.coerce.boolean() : z.boolean();
      case TYPE.Date:
        return z.string().datetime().or(z.date());
      case TYPE.ObjectId:
        return z.string();
      case TYPE.JSON:
        return z.record(z.any(), z.any());
      case TYPE.Relation:
        return z.string();
      default:
        return z.any();
    }
  }

  private extractTypesInternal(
    name: string,
    fields: ConduitModel | ConduitReturn,
  ): ZodParseResult {
    const result: ZodParseResult = {};

    if (typeof fields === 'string') {
      const zodType = this.getZodType(fields as TYPE);
      result[name] = zodType;
    } else {
      for (const fieldName in fields) {
        if (!fields.hasOwnProperty(fieldName)) continue;

        const field = fields[fieldName];
        const zodType = this.parseField(fieldName, field);
        result[fieldName] = zodType;
      }
    }

    return result;
  }

  private parseField(fieldName: string, field: unknown): z.ZodTypeAny {
    const isRequired = ParserUtils.isFieldRequired(field);
    const description = ParserUtils.getFieldDescription(field);

    if (typeof field === 'string') {
      let zodType = this.getZodType(field as TYPE);
      if (!isRequired) zodType = zodType.optional();
      if (description) zodType = zodType.describe(description);
      return zodType;
    }

    if (ParserUtils.isArrayType(field)) {
      return this.parseArrayField(fieldName, field as UntypedArray);
    }

    if (typeof field === 'object' && field !== null) {
      return this.parseObjectField(fieldName, field as Record<string, unknown>);
    }

    return z.any();
  }

  private parseArrayField(
    fieldName: string,
    field: UntypedArray,
    parentField?: Record<string, unknown>,
  ): z.ZodTypeAny {
    if (field.length === 0) {
      return z.array(z.any());
    }

    const firstItem = field[0];
    let itemType: z.ZodTypeAny;

    if (typeof firstItem === 'string') {
      itemType = this.getZodType(firstItem as TYPE);
    } else if (typeof firstItem === 'object' && firstItem !== null) {
      if (firstItem.type) {
        if (firstItem.type === TYPE.Relation) {
          itemType = z.string();
        } else if (typeof firstItem.type === 'string') {
          itemType = this.getZodType(firstItem.type as TYPE);
        } else {
          const nestedResult = this.extractTypesInternal(
            fieldName,
            firstItem.type as ConduitModel | ConduitReturn,
          );
          itemType =
            Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
        }

        if (firstItem.description) {
          itemType = itemType.describe(firstItem.description);
        }
      } else {
        const nestedResult = this.extractTypesInternal(fieldName, firstItem);
        itemType =
          Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
      }
    } else {
      itemType = z.any();
    }

    let arrayType = z.array(itemType);
    const v = parentField?.validate as Record<string, unknown> | undefined;
    if (v) {
      if (v.minItems != null) arrayType = arrayType.min(v.minItems as number);
      if (v.maxItems != null) arrayType = arrayType.max(v.maxItems as number);
    }
    return arrayType;
  }

  private parseObjectField(
    fieldName: string,
    field: Record<string, unknown>,
  ): z.ZodTypeAny {
    const isRequired = ParserUtils.isFieldRequired(field);
    const description = ParserUtils.getFieldDescription(field);

    if (ParserUtils.hasTypeProperty(field)) {
      let zodType: z.ZodTypeAny;

      if (ParserUtils.isRelationType(field)) {
        zodType = z.string();
      } else if (typeof field.type === 'string') {
        zodType = this.getZodType(field.type as TYPE);
      } else if (Array.isArray(field.type)) {
        zodType = this.parseArrayField(fieldName, field.type, field);
      } else {
        const nestedResult = this.extractTypesInternal(
          fieldName,
          field.type as ConduitModel | ConduitReturn,
        );
        zodType =
          Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
      }

      zodType = this.applyValidation(zodType, field);

      if (!isRequired) {
        zodType = zodType.optional();
      }

      if (description) {
        zodType = zodType.describe(description);
      }

      return zodType;
    }

    const nestedResult = this.extractTypesInternal(fieldName, field as ConduitModel);
    return Object.keys(nestedResult).length > 0 ? z.object(nestedResult) : z.object({});
  }
}
