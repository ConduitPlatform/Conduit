/**
 * MCP Module Exports
 *
 * Exports Conduit MCP integration components and re-exports useful SDK types
 */

// Conduit MCP components
export * from './types.js';
export * from './MCPController.js';
export * from './ToolRegistry.js';
export * from './ResourceRegistry.js';
export * from './RouteToTool.js';
export * from './MCPParser.js';
export * from './constants.js';
export * from './MetaTools.js';
export { MCPError, MCP_ERROR_CODES } from './MCPErrors.js';
export { API_GUIDE_CONTENT } from './apiGuide.js';

// Re-export useful SDK types and classes for convenience
export { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
export type {
  Tool,
  CallToolResult,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from '@modelcontextprotocol/sdk/types.js';
