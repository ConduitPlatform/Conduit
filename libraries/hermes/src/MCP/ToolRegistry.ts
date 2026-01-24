/**
 * Tool Registry for MCP Server
 *
 * Wraps the official SDK's McpServer tool registration with Conduit-specific logic.
 * Manages tool registration, validation, and integration with Conduit's admin system.
 *
 * Supports module-based tool organization with lazy loading:
 * - Tools are grouped by module (e.g., 'authentication', 'storage')
 * - Module tools start disabled and can be enabled/disabled on-demand
 * - Meta-tools (list_modules, load_module, etc.) are always enabled
 */

import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPModuleInfo, MCPSession, MCPToolDefinition } from './types.js';

/** Special module name for meta-tools that are always enabled */
export const META_MODULE = '__meta__';

/** Special module name for core/root-level tools */
export const CORE_MODULE = 'core';

export class ToolRegistry {
  /** All registered tool definitions */
  private _tools: Map<string, MCPToolDefinition> = new Map();

  /** SDK RegisteredTool handles for enable/disable/remove operations */
  private _toolHandles: Map<string, RegisteredTool> = new Map();

  /** Map of module name -> Set of tool names belonging to that module */
  private _moduleTools: Map<string, Set<string>> = new Map();

  /** Set of currently loaded (enabled) modules */
  private _loadedModules: Set<string> = new Set();

  private _grpcSdk: ConduitGrpcSdk;
  private _mcpServer: McpServer | null = null;

  constructor(grpcSdk: ConduitGrpcSdk) {
    this._grpcSdk = grpcSdk;
    // Meta module and core module are always loaded
    this._loadedModules.add(META_MODULE);
    this._loadedModules.add(CORE_MODULE);
  }

  /**
   * Set the MCP server instance (must be called before registering tools)
   */
  setMcpServer(server: McpServer): void {
    this._mcpServer = server;
  }

  /**
   * Register a tool with the MCP server
   * @param tool - The tool definition
   * @param session - Optional session for tool execution context
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
      this.unregisterTool(tool.name);
    }

    // Determine the module for this tool
    const moduleName = tool.module || CORE_MODULE;

    // Store the tool definition with module info
    const toolWithModule = { ...tool, module: moduleName };
    this._tools.set(tool.name, toolWithModule);

    // Track tool under its module
    if (!this._moduleTools.has(moduleName)) {
      this._moduleTools.set(moduleName, new Set());
    }
    this._moduleTools.get(moduleName)!.add(tool.name);

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

    // Store the handle if it exists
    if (handle !== undefined && handle !== null) {
      this._toolHandles.set(tool.name, handle);

      // Disable the tool if it should start disabled (non-meta and non-core module tools)
      const shouldBeDisabled =
        tool.initiallyDisabled === true ||
        (moduleName !== META_MODULE &&
          moduleName !== CORE_MODULE &&
          !this._loadedModules.has(moduleName));

      if (shouldBeDisabled) {
        handle.disable();
        ConduitGrpcSdk.Logger.log(
          `Registered MCP tool (disabled): ${tool.name} [module: ${moduleName}]`,
        );
      } else {
        ConduitGrpcSdk.Logger.log(
          `Registered MCP tool (enabled): ${tool.name} [module: ${moduleName}]`,
        );
      }
    }
  }

  /**
   * Unregister a tool from the MCP server
   */
  unregisterTool(name: string): boolean {
    const tool = this._tools.get(name);

    // Remove from SDK using the handle
    const handle = this._toolHandles.get(name);
    if (handle !== undefined && handle !== null) {
      handle.remove();
    }
    this._toolHandles.delete(name);

    // Remove from module tracking
    if (tool?.module) {
      const moduleSet = this._moduleTools.get(tool.module);
      if (moduleSet) {
        moduleSet.delete(name);
        if (moduleSet.size === 0) {
          this._moduleTools.delete(tool.module);
        }
      }
    }

    // Remove from our registry
    const removed = this._tools.delete(name);
    if (removed) {
      ConduitGrpcSdk.Logger.log(`Unregistered MCP tool: ${name}`);
    }
    return removed;
  }

  /**
   * Enable all tools for a specific module
   * @returns Array of tool names that were enabled
   */
  enableModule(moduleName: string): string[] {
    const toolNames = this._moduleTools.get(moduleName);
    if (!toolNames || toolNames.size === 0) {
      ConduitGrpcSdk.Logger.warn(`No tools found for module: ${moduleName}`);
      return [];
    }

    const enabledTools: string[] = [];
    for (const toolName of toolNames) {
      const handle = this._toolHandles.get(toolName);
      if (handle) {
        handle.enable();
        enabledTools.push(toolName);
      }
    }

    this._loadedModules.add(moduleName);
    ConduitGrpcSdk.Logger.log(
      `Enabled module ${moduleName}: ${enabledTools.length} tools`,
    );
    return enabledTools;
  }

  /**
   * Enable multiple modules at once (batch operation)
   * @param moduleNames - Array of module names to enable
   * @returns Map of module name -> array of enabled tool names
   */
  enableModules(moduleNames: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const moduleName of moduleNames) {
      // Skip meta module and core module (always enabled)
      if (moduleName === META_MODULE || moduleName === CORE_MODULE) continue;

      const enabledTools = this.enableModule(moduleName);
      if (enabledTools.length > 0) {
        result.set(moduleName, enabledTools);
      }
    }

    if (result.size > 0) {
      ConduitGrpcSdk.Logger.log(`Enabled ${result.size} modules via batch operation`);
    }

    return result;
  }

  /**
   * Disable all tools for a specific module
   * @returns Array of tool names that were disabled
   */
  disableModule(moduleName: string): string[] {
    // Prevent disabling meta module or core module
    if (moduleName === META_MODULE || moduleName === CORE_MODULE) {
      ConduitGrpcSdk.Logger.warn('Cannot disable meta or core module');
      return [];
    }

    const toolNames = this._moduleTools.get(moduleName);
    if (!toolNames || toolNames.size === 0) {
      ConduitGrpcSdk.Logger.warn(`No tools found for module: ${moduleName}`);
      return [];
    }

    const disabledTools: string[] = [];
    for (const toolName of toolNames) {
      const handle = this._toolHandles.get(toolName);
      if (handle) {
        handle.disable();
        disabledTools.push(toolName);
      }
    }

    this._loadedModules.delete(moduleName);
    ConduitGrpcSdk.Logger.log(
      `Disabled module ${moduleName}: ${disabledTools.length} tools`,
    );
    return disabledTools;
  }

  /**
   * Get list of all modules with their tool counts and loaded status
   */
  getModules(): MCPModuleInfo[] {
    const modules: MCPModuleInfo[] = [];

    for (const [moduleName, toolNames] of this._moduleTools) {
      // Skip meta module from public listing
      if (moduleName === META_MODULE) continue;

      modules.push({
        name: moduleName,
        toolCount: toolNames.size,
        loaded: this._loadedModules.has(moduleName),
      });
    }

    // Sort by name for consistent ordering
    return modules.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get list of currently loaded (enabled) modules
   */
  getLoadedModules(): string[] {
    return Array.from(this._loadedModules).filter(m => m !== META_MODULE);
  }

  /**
   * Check if a module is currently loaded
   */
  isModuleLoaded(moduleName: string): boolean {
    return this._loadedModules.has(moduleName);
  }

  /**
   * Get tool names for a specific module
   */
  getModuleToolNames(moduleName: string): string[] {
    const toolNames = this._moduleTools.get(moduleName);
    return toolNames ? Array.from(toolNames) : [];
  }

  /**
   * Get the count of registered tools
   */
  getToolCount(): number {
    return this._tools.size;
  }

  /**
   * Get count of enabled tools (from loaded modules)
   */
  getEnabledToolCount(): number {
    let count = 0;
    for (const moduleName of this._loadedModules) {
      const tools = this._moduleTools.get(moduleName);
      if (tools) {
        count += tools.size;
      }
    }
    return count;
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
    this._moduleTools.clear();

    // Reset loaded modules but keep meta
    this._loadedModules.clear();
    this._loadedModules.add(META_MODULE);

    ConduitGrpcSdk.Logger.log('Cleared all MCP tools');
  }

  /**
   * Clear module tools only (preserve meta-tools)
   * Used during router refresh
   */
  clearModuleTools(): void {
    for (const [moduleName, toolNames] of this._moduleTools) {
      if (moduleName === META_MODULE) continue;

      for (const toolName of toolNames) {
        const handle = this._toolHandles.get(toolName);
        if (handle) {
          handle.remove();
        }
        this._toolHandles.delete(toolName);
        this._tools.delete(toolName);
      }
    }

    // Clear module tracking except meta
    const metaTools = this._moduleTools.get(META_MODULE);
    this._moduleTools.clear();
    if (metaTools) {
      this._moduleTools.set(META_MODULE, metaTools);
    }

    // Reset loaded modules but keep meta
    this._loadedModules.clear();
    this._loadedModules.add(META_MODULE);

    ConduitGrpcSdk.Logger.log('Cleared module MCP tools (meta-tools preserved)');
  }
}
