/**
 * MCP Meta-Tools for Module Discovery
 *
 * These tools allow LLMs to discover available modules.
 *
 * Note: The preferred way to enable modules is via URL query parameters:
 * /mcp?modules=authentication,storage
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
      'Lists all available modules with their tool counts and loaded status. Call this first to discover capabilities. ' +
      'If a module you need has loaded: false, you cannot enable it at runtime. Instruct the user to update their MCP server URL: ' +
      'append ?modules=module1,module2 to the base URL (e.g. https://host:port/mcp?modules=authentication,database). ' +
      'In Cursor, edit .cursor/mcp.json and set the server url to include ?modules= and the required module names. ' +
      "Each enabled module also exposes get_config_<module> and patch_config_<module> for reading and updating that module's configuration.",
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
      totalModules: z.number().describe('Total number of available modules'),
      loadedModules: z.number().describe('Number of currently loaded modules'),
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
 * Register all meta-tools with the registry
 */
export function registerMetaTools(registry: ToolRegistry): void {
  const metaTools = [createListModulesTool(registry)];

  for (const tool of metaTools) {
    registry.registerTool(tool);
  }

  ConduitGrpcSdk.Logger.log(`Registered ${metaTools.length} MCP meta-tools`);
}
