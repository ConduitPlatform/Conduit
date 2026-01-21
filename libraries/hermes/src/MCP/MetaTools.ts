/**
 * MCP Meta-Tools for Module Discovery
 *
 * These tools allow LLMs to discover and load module-specific tools on-demand,
 * reducing the initial tool count and improving context efficiency.
 *
 * Meta-tools are always enabled and cannot be disabled.
 */

import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPToolDefinition } from './types.js';
import { META_MODULE, ToolRegistry } from './ToolRegistry.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

/**
 * Create the list_modules meta-tool
 * Returns available modules with their tool counts and loaded status
 */
export function createListModulesTool(registry: ToolRegistry): MCPToolDefinition {
  return {
    name: 'list_modules',
    title: 'List Available Modules',
    description:
      'Lists all available modules with their tool counts. Use this to discover what capabilities are available before loading specific module tools.',
    module: META_MODULE,
    initiallyDisabled: false,
    inputSchema: {},
    outputSchema: {
      modules: z
        .array(
          z.object({
            name: z.string().describe('Module name'),
            toolCount: z.number().describe('Number of tools in this module'),
            loaded: z.boolean().describe('Whether the module tools are currently loaded'),
          }),
        )
        .describe('List of available modules'),
    },
    handler: async (): Promise<CallToolResult> => {
      const modules = registry.getModules();

      const result = {
        modules,
        totalModules: modules.length,
        loadedModules: modules.filter(m => m.loaded).length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    },
  };
}

/**
 * Create the load_module meta-tool
 * Enables all tools for a specific module
 */
export function createLoadModuleTool(registry: ToolRegistry): MCPToolDefinition {
  return {
    name: 'load_module',
    title: 'Load Module Tools',
    description:
      'Loads (enables) all tools for a specific module. After loading, the module tools will appear in the tools list. Use list_modules first to see available modules.',
    module: META_MODULE,
    initiallyDisabled: false,
    inputSchema: {
      module: z
        .string()
        .describe(
          'The name of the module to load (e.g., "authentication", "storage", "email")',
        ),
    },
    outputSchema: {
      success: z.boolean().describe('Whether the module was successfully loaded'),
      module: z.string().describe('The module that was loaded'),
      loadedTools: z.array(z.string()).describe('List of tool names that were enabled'),
    },
    handler: async (args): Promise<CallToolResult> => {
      const moduleName = args.module as string;

      if (!moduleName) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: module parameter is required',
            },
          ],
          isError: true,
        };
      }

      // Check if module exists
      const modules = registry.getModules();
      const moduleExists = modules.some(m => m.name === moduleName);

      if (!moduleExists) {
        const availableModules = modules.map(m => m.name).join(', ');
        return {
          content: [
            {
              type: 'text',
              text: `Error: Module "${moduleName}" not found. Available modules: ${availableModules}`,
            },
          ],
          isError: true,
        };
      }

      // Check if already loaded
      if (registry.isModuleLoaded(moduleName)) {
        const toolNames = registry.getModuleToolNames(moduleName);
        const result = {
          success: true,
          module: moduleName,
          loadedTools: toolNames,
          message: 'Module was already loaded',
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        };
      }

      // Enable the module
      const enabledTools = registry.enableModule(moduleName);

      const result = {
        success: true,
        module: moduleName,
        loadedTools: enabledTools,
        message: `Successfully loaded ${enabledTools.length} tools from module "${moduleName}"`,
      };

      ConduitGrpcSdk.Logger.log(
        `MCP: Loaded module "${moduleName}" with ${enabledTools.length} tools`,
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    },
  };
}

/**
 * Create the unload_module meta-tool
 * Disables all tools for a specific module
 */
export function createUnloadModuleTool(registry: ToolRegistry): MCPToolDefinition {
  return {
    name: 'unload_module',
    title: 'Unload Module Tools',
    description:
      'Unloads (disables) all tools for a specific module. The tools will no longer appear in the tools list until loaded again.',
    module: META_MODULE,
    initiallyDisabled: false,
    inputSchema: {
      module: z
        .string()
        .describe('The name of the module to unload (e.g., "authentication", "storage")'),
    },
    outputSchema: {
      success: z.boolean().describe('Whether the module was successfully unloaded'),
      module: z.string().describe('The module that was unloaded'),
      unloadedTools: z
        .array(z.string())
        .describe('List of tool names that were disabled'),
    },
    handler: async (args): Promise<CallToolResult> => {
      const moduleName = args.module as string;

      if (!moduleName) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: module parameter is required',
            },
          ],
          isError: true,
        };
      }

      // Check if module is loaded
      if (!registry.isModuleLoaded(moduleName)) {
        return {
          content: [
            {
              type: 'text',
              text: `Module "${moduleName}" is not currently loaded`,
            },
          ],
          structuredContent: {
            success: true,
            module: moduleName,
            unloadedTools: [],
            message: 'Module was not loaded',
          },
        };
      }

      // Disable the module
      const disabledTools = registry.disableModule(moduleName);

      const result = {
        success: true,
        module: moduleName,
        unloadedTools: disabledTools,
        message: `Successfully unloaded ${disabledTools.length} tools from module "${moduleName}"`,
      };

      ConduitGrpcSdk.Logger.log(`MCP: Unloaded module "${moduleName}"`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    },
  };
}

/**
 * Create the list_loaded_modules meta-tool
 * Returns currently loaded modules with their tools
 */
export function createListLoadedModulesTool(registry: ToolRegistry): MCPToolDefinition {
  return {
    name: 'list_loaded_modules',
    title: 'List Loaded Modules',
    description:
      'Lists all currently loaded (enabled) modules and their tools. Use this to see what module tools are currently available.',
    module: META_MODULE,
    initiallyDisabled: false,
    inputSchema: {},
    outputSchema: {
      loadedModules: z
        .array(
          z.object({
            name: z.string().describe('Module name'),
            tools: z.array(z.string()).describe('Tool names in this module'),
          }),
        )
        .describe('List of loaded modules with their tools'),
    },
    handler: async (): Promise<CallToolResult> => {
      const loadedModuleNames = registry.getLoadedModules();

      const loadedModules = loadedModuleNames.map(moduleName => ({
        name: moduleName,
        tools: registry.getModuleToolNames(moduleName),
      }));

      const result = {
        loadedModules,
        totalLoadedModules: loadedModules.length,
        totalLoadedTools: loadedModules.reduce((sum, m) => sum + m.tools.length, 0),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    },
  };
}

/**
 * Register all meta-tools with the registry
 */
export function registerMetaTools(registry: ToolRegistry): void {
  const metaTools = [
    createListModulesTool(registry),
    createLoadModuleTool(registry),
    createUnloadModuleTool(registry),
    createListLoadedModulesTool(registry),
  ];

  for (const tool of metaTools) {
    registry.registerTool(tool);
  }

  ConduitGrpcSdk.Logger.log(`Registered ${metaTools.length} MCP meta-tools`);
}
