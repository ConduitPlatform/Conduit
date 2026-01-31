import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

// Re-export SDK types for convenience
export type { CallToolResult, Tool };

// Conduit-specific MCP types

/**
 * Configuration for the MCP server integration in Conduit
 */
export interface MCPConfig {
  enabled: boolean;
  path: string;
  protocolVersion: string;
  serverInfo: {
    name: string;
    title?: string;
    version: string;
  };
  capabilities: {
    tools: {
      listChanged: boolean;
    };
    resources: {
      listChanged: boolean;
    };
  };
}

/**
 * Session information passed to tool handlers
 * Contains context from Express request (populated by global middleware)
 */
export interface MCPSession {
  headers: Record<string, string | string[] | undefined>;
  context: Record<string, unknown>; // From req.conduit
  authenticated?: boolean; // Derived from context
  user?: Record<string, unknown>; // From context if available
}

/**
 * Tool definition that wraps SDK Tool with Conduit-specific handler
 */
export interface MCPToolDefinition {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, any>; // Zod schema object
  outputSchema?: Record<string, any>; // Zod schema object
  handler: (
    args: Record<string, unknown>,
    session: MCPSession,
    grpcSdk: ConduitGrpcSdk,
  ) => Promise<CallToolResult>;
  adminOnly?: boolean;
  /** The module this tool belongs to (e.g., 'authentication', 'storage') */
  module?: string;
  /** If true, the tool is registered but disabled until explicitly enabled */
  initiallyDisabled?: boolean;
}

/**
 * Module information for discovery
 */
export interface MCPModuleInfo {
  name: string;
  toolCount: number;
  loaded: boolean;
}

/**
 * Options for converting Conduit routes to MCP tools
 */
export interface MCPRouteToToolOptions {
  prefix?: string;
  includeModule?: boolean;
  adminOnly?: boolean;
  customDescriptions?: Record<string, string>;
  /** The module this tool belongs to */
  module?: string;
}

/**
 * Resource definition for MCP resources
 * Resources provide read-only data to MCP clients (e.g., documentation, schemas)
 */
export interface MCPResourceDefinition {
  /** Unique URI for the resource (e.g., "conduit://docs/admin-api/swagger") */
  uri: string;
  /** Human-readable name for the resource */
  name: string;
  /** Description of what the resource contains */
  description: string;
  /** MIME type of the resource content */
  mimeType: string;
  /** Function that provides the resource content */
  contentProvider: () => Promise<string> | string;
}

/**
 * Provider function type for accessing Swagger documentation
 */
export type SwaggerDocProvider = () => Record<string, unknown> | null;
