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
    options: { unknownKeys?: 'strict' | 'strip' | 'passthrough'; coerce?: boolean } = {},
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const { unknownKeys = 'strip', coerce = false } = options;
    const prevCoerce = this.useCoercion;
    try {
      if (coerce) this.useCoercion = true;
      const fields = this.extractTypes('params', params as ConduitModel, true);
      const schema = z.object(fields);
      if (unknownKeys === 'strict') return schema.strict();
      if (unknownKeys === 'passthrough') return schema.passthrough();
      return schema;
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

    const msg = validate.message as string | undefined;

    if (zodType instanceof z.ZodString) {
      let s = zodType as z.ZodString;
      if (validate.format === 'email') s = msg ? s.email(msg) : s.email();
      if (validate.format === 'url') s = msg ? s.url(msg) : s.url();
      if (validate.format === 'uuid') s = msg ? s.uuid(msg) : s.uuid();
      if (validate.format === 'objectId') {
        const oidMsg = msg ?? 'Invalid ObjectId format';
        s = s.regex(
          /^([a-f\d]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
          oidMsg,
        );
      }
      if (validate.minLength != null) {
        const n = validate.minLength as number;
        s = msg ? s.min(n, msg) : s.min(n);
      }
      if (validate.maxLength != null) {
        const n = validate.maxLength as number;
        s = msg ? s.max(n, msg) : s.max(n);
      }
      if (validate.length != null) {
        const n = validate.length as number;
        s = msg ? s.length(n, msg) : s.length(n);
      }
      if (validate.pattern) {
        const re = new RegExp(validate.pattern as string);
        s = msg ? s.regex(re, msg) : s.regex(re);
      }
      return s;
    }

    if (zodType instanceof z.ZodNumber) {
      let n = zodType as z.ZodNumber;
      if (validate.min != null) {
        const v = validate.min as number;
        n = msg ? n.gte(v, msg) : n.gte(v);
      }
      if (validate.max != null) {
        const v = validate.max as number;
        n = msg ? n.lte(v, msg) : n.lte(v);
      }
      if (validate.exclusiveMin != null) {
        const v = validate.exclusiveMin as number;
        n = msg ? n.gt(v, msg) : n.gt(v);
      }
      if (validate.exclusiveMax != null) {
        const v = validate.exclusiveMax as number;
        n = msg ? n.lt(v, msg) : n.lt(v);
      }
      if (validate.integer) n = msg ? n.int(msg) : n.int();
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
      return this.parseArrayField(fieldName, field as UntypedArray).optional();
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
      const arrMsg = v.message as string | undefined;
      if (v.minItems != null) {
        const n = v.minItems as number;
        arrayType = arrMsg ? arrayType.min(n, arrMsg) : arrayType.min(n);
      }
      if (v.maxItems != null) {
        const n = v.maxItems as number;
        arrayType = arrMsg ? arrayType.max(n, arrMsg) : arrayType.max(n);
      }
    }
    if (this.useCoercion) {
      return z.preprocess(
        val => (Array.isArray(val) ? val : val != null ? [val] : val),
        arrayType,
      );
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
