/**
 * Tool Registry for MCP Server
 *
 * Wraps the official SDK's McpServer tool registration with Conduit-specific logic.
 * Manages tool registration, validation, and integration with Conduit's admin system.
 *
 * Supports module-based tool organization with lazy loading:
 * - Tools are grouped by module (e.g. 'authentication', 'storage')
 * - Module tools start disabled and can be enabled/disabled on-demand
 * - Meta-tools (list_modules, load_module, etc.) are always enabled
 *
 * Definitions are stored here; each HTTP request creates a fresh McpServer and calls
 * populateServer() to register tools on that instance (one transport per McpServer).
 */

import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPModuleInfo, MCPSession, MCPToolDefinition } from './types.js';

/** Special module name for meta-tools that are always enabled */
export const META_MODULE = '__meta__';

/** Special module name for core/root-level tools */
export const CORE_MODULE = 'core';

export class ToolRegistry {
  /** All registered tool definitions */
  private _tools: Map<string, MCPToolDefinition> = new Map();

  /** Map of module name -> Set of tool names belonging to that module */
  private _moduleTools: Map<string, Set<string>> = new Map();

  /** Set of currently loaded (enabled) modules */
  private _loadedModules: Set<string> = new Set();

  /** Optional fixed session bound at registerTool() time (rare) */
  private _sessions: Map<string, MCPSession> = new Map();

  private _grpcSdk: ConduitGrpcSdk;

  constructor(grpcSdk: ConduitGrpcSdk) {
    this._grpcSdk = grpcSdk;
    // Meta module and core module are always loaded
    this._loadedModules.add(META_MODULE);
    this._loadedModules.add(CORE_MODULE);
  }

  /**
   * Register a tool definition (SDK registration happens in populateServer per request)
   * @param tool - The tool definition
   * @param session - Optional session for tool execution context
   */
  registerTool(tool: MCPToolDefinition, session?: MCPSession): void {
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

    if (session) {
      this._sessions.set(tool.name, session);
    } else {
      this._sessions.delete(tool.name);
    }

    ConduitGrpcSdk.Logger.log(
      `Stored MCP tool definition: ${tool.name} [module: ${moduleName}]`,
    );
  }

  /**
   * Register all tool definitions on a per-request McpServer instance.
   * @param mcpServer - Fresh server instance for this HTTP request
   * @param enabledModules - Modules whose tools should be enabled (includes meta/core when loaded)
   */
  populateServer(mcpServer: McpServer, enabledModules: Set<string>): void {
    for (const tool of this._tools.values()) {
      const moduleName = tool.module || CORE_MODULE;

      const handle = mcpServer.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        },
        async (args: Record<string, unknown>) => {
          const execSession = this._sessions.get(tool.name) ?? {
            headers: {},
            context: {},
            authenticated: false,
          };

          return await tool.handler(args, execSession, this._grpcSdk);
        },
      );

      if (handle !== undefined && handle !== null) {
        const shouldBeDisabled =
          tool.initiallyDisabled === true ||
          (moduleName !== META_MODULE &&
            moduleName !== CORE_MODULE &&
            !enabledModules.has(moduleName));

        if (shouldBeDisabled) {
          handle.disable();
        }
      }
    }
  }

  /**
   * All module names that are currently marked loaded (for populateServer)
   */
  getLoadedModulesFull(): Set<string> {
    return new Set(this._loadedModules);
  }

  /**
   * Unregister a tool from the registry (definitions only)
   */
  unregisterTool(name: string): boolean {
    const tool = this._tools.get(name);

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

    this._sessions.delete(name);

    const removed = this._tools.delete(name);
    if (removed) {
      ConduitGrpcSdk.Logger.log(`Unregistered MCP tool: ${name}`);
    }
    return removed;
  }

  /**
   * Enable all tools for a specific module (bookkeeping; SDK state is per-request)
   * @returns Array of tool names that belong to the module
   */
  enableModule(moduleName: string): string[] {
    const toolNames = this._moduleTools.get(moduleName);
    if (!toolNames || toolNames.size === 0) {
      ConduitGrpcSdk.Logger.warn(`No tools found for module: ${moduleName}`);
      return [];
    }

    this._loadedModules.add(moduleName);
    const enabledTools = Array.from(toolNames);
    ConduitGrpcSdk.Logger.log(
      `Enabled module ${moduleName}: ${enabledTools.length} tools`,
    );
    return enabledTools;
  }

  /**
   * Enable multiple modules at once (batch operation)
   * @param moduleNames - Array of module names to enable
   * @returns Map of module name -> array of tool names in that module
   */
  enableModules(moduleNames: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const moduleName of moduleNames) {
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
   * Disable all tools for a specific module (bookkeeping)
   * @returns Array of tool names that belonged to the module
   */
  disableModule(moduleName: string): string[] {
    if (moduleName === META_MODULE || moduleName === CORE_MODULE) {
      ConduitGrpcSdk.Logger.warn('Cannot disable meta or core module');
      return [];
    }

    const toolNames = this._moduleTools.get(moduleName);
    if (!toolNames || toolNames.size === 0) {
      ConduitGrpcSdk.Logger.warn(`No tools found for module: ${moduleName}`);
      return [];
    }

    const disabledTools = Array.from(toolNames);
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
      if (moduleName === META_MODULE) continue;

      modules.push({
        name: moduleName,
        toolCount: toolNames.size,
        loaded: this._loadedModules.has(moduleName),
      });
    }

    return modules.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get list of currently loaded (enabled) modules (excludes meta from listing)
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
   */
  clearAllTools(): void {
    this._tools.clear();
    this._moduleTools.clear();
    this._sessions.clear();

    this._loadedModules.clear();
    this._loadedModules.add(META_MODULE);
    this._loadedModules.add(CORE_MODULE);

    ConduitGrpcSdk.Logger.log('Cleared all MCP tools');
  }

  /**
   * Clear module tools only (preserve meta-tools)
   */
  clearModuleTools(): void {
    for (const [moduleName, toolNames] of this._moduleTools) {
      if (moduleName === META_MODULE) continue;

      for (const toolName of toolNames) {
        this._tools.delete(toolName);
        this._sessions.delete(toolName);
      }
    }

    const metaTools = this._moduleTools.get(META_MODULE);
    this._moduleTools.clear();
    if (metaTools) {
      this._moduleTools.set(META_MODULE, metaTools);
    }

    this._loadedModules.clear();
    this._loadedModules.add(META_MODULE);
    this._loadedModules.add(CORE_MODULE);

    ConduitGrpcSdk.Logger.log('Cleared module MCP tools (meta-tools preserved)');
  }
}
