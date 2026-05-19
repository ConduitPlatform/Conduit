/**
 * Schema Field Type Definitions
 *
 * These types provide proper documentation for the schema field structure
 * used in database admin routes. They help Swagger/OpenAPI and MCP
 * accurately describe the expected input format.
 */

import { ConduitBoolean, ConduitString } from '@conduitplatform/module-tools';
import { TYPE } from '@conduitplatform/grpc-sdk';

/**
 * Schema field definition - describes a single field in a schema
 *
 * A field can be defined in multiple formats:
 * 1. Shorthand: Just the type string (e.g., "String", "Number")
 * 2. Object: { type: "String", required: true, unique: false }
 * 3. Array: ["String"] or [{ type: "String" }]
 * 4. Nested: Objects without 'type' are treated as nested schemas
 */
export const SchemaField = {
  type: {
    type: 'String',
    required: true,
    description:
      'Field type. One of: String, Number, Boolean, Date, ObjectId, JSON, Relation',
  },
  required: ConduitBoolean.Optional,
  unique: ConduitBoolean.Optional,
  select: ConduitBoolean.Optional,
  default: ConduitString.Optional,
  description: ConduitString.Optional,
  model: {
    type: 'String',
    required: false,
    description: 'Required when type is "Relation". The name of the related schema.',
  },
};

/**
 * Schema fields object with comprehensive description
 *
 * This provides documentation for the fields parameter in schema creation/update routes.
 * The actual structure is dynamic (field names are keys) so we use a description
 * to document the expected format.
 */
export const SchemaFieldsDescription = `Object mapping field names to field definitions.

**Field Types:** String, Number, Boolean, Date, ObjectId, JSON, Relation

**Definition Formats:**
- Shorthand: \`{ fieldName: "String" }\`
- Object: \`{ fieldName: { type: "String", required: true } }\`
- Array: \`{ fieldName: ["String"] }\` or \`{ fieldName: [{ type: "String" }] }\`
- Relation: \`{ fieldName: { type: "Relation", model: "SchemaName" } }\`
- Nested: \`{ fieldName: { nestedField: { type: "String" } } }\`

**Field Properties:**
- \`type\` (required): String | Number | Boolean | Date | ObjectId | JSON | Relation
- \`required\` (optional): boolean - Whether the field is required
- \`unique\` (optional): boolean - Whether values must be unique (requires required: true)
- \`select\` (optional): boolean - Whether to include in query results by default
- \`default\` (optional): string - Default value for the field
- \`description\` (optional): string - Field description
- \`model\` (required for Relation): string - Name of the related schema

**Example:**
\`\`\`json
{
  "name": { "type": "String", "required": true },
  "price": { "type": "Number", "required": true },
  "description": "String",
  "category": { "type": "Relation", "model": "Category" },
  "tags": ["String"],
  "metadata": { "key": "String", "value": "String" }
}
\`\`\``;

/**
 * Required schema fields definition for route parameters
 */
export const SchemaFieldsRequired: {
  type: TYPE.JSON;
  required: true;
  description: string;
} = {
  type: TYPE.JSON,
  required: true,
  description: SchemaFieldsDescription,
};

/**
 * Optional schema fields definition for route parameters
 */
export const SchemaFieldsOptional: {
  type: TYPE.JSON;
  required: false;
  description: string;
} = {
  type: TYPE.JSON,
  required: false,
  description: SchemaFieldsDescription,
};
