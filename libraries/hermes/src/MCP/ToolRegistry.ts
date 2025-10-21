/**
 * Tool Registry for MCP Server
 *
 * Wraps the official SDK's McpServer tool registration with Conduit-specific logic.
 * Manages tool registration, validation, and integration with Conduit's admin system.
 */

import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPSession, MCPToolDefinition } from './types.js';

export class ToolRegistry {
  private _tools: Map<string, MCPToolDefinition> = new Map();
  private _toolHandles: Map<string, RegisteredTool> = new Map(); // Track SDK registration handles
  private _grpcSdk: ConduitGrpcSdk;
  private _mcpServer: McpServer | null = null;

  constructor(grpcSdk: ConduitGrpcSdk) {
    this._grpcSdk = grpcSdk;
  }

  /**
   * Set the MCP server instance (must be called before registering tools)
   */
  setMcpServer(server: McpServer): void {
    this._mcpServer = server;
  }

  /**
   * Register a tool with the MCP server
   */
  registerTool(tool: MCPToolDefinition, session?: MCPSession): void {
    if (!this._mcpServer) {
      throw new Error('MCP server not initialized. Call setMcpServer() first.');
    }

    // Unregister existing tool if it exists
    if (this._tools.has(tool.name)) {
      ConduitGrpcSdk.Logger.warn(
        `Tool ${tool.name} is already registered. Removing old registration.`,
      );
      this.unregisterTool(tool.name); // Actually remove it
    }

    // Store the tool definition
    this._tools.set(tool.name, tool);

    // Register with SDK and store the handle
    const handle = this._mcpServer.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      },
      async (args: Record<string, unknown>) => {
        // Create a minimal session if not provided
        const execSession = session || {
          headers: {},
          context: {},
          authenticated: false,
        };

        // Execute the Conduit handler
        return await tool.handler(args, execSession, this._grpcSdk);
      },
    );

    // Only store the handle if it exists (SDK might return undefined)
    if (handle !== undefined && handle !== null) {
      this._toolHandles.set(tool.name, handle);
    }

    ConduitGrpcSdk.Logger.log(`Registered MCP tool: ${tool.name}`);
  }

  /**
   * Unregister a tool from the MCP server
   */
  unregisterTool(name: string): boolean {
    // Remove from SDK using the handle
    const handle = this._toolHandles.get(name);
    if (handle !== undefined && handle !== null) {
      handle.remove();
    }
    this._toolHandles.delete(name);

    // Remove from our registry
    const removed = this._tools.delete(name);
    if (removed) {
      ConduitGrpcSdk.Logger.log(`Unregistered MCP tool: ${name}`);
    }
    return removed;
  }

  /**
   * Get the count of registered tools
   */
  getToolCount(): number {
    return this._tools.size;
  }

  /**
   * Clear all registered tools
   * Used during router refresh to prevent duplicates
   */
  clearAllTools(): void {
    // Properly unregister each tool using SDK handles
    this._toolHandles.forEach((handle, name) => {
      if (handle !== undefined && handle !== null) {
        handle.remove();
      }
    });

    this._toolHandles.clear();
    this._tools.clear();
    ConduitGrpcSdk.Logger.log('Cleared all MCP tools');
  }
}
