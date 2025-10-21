/**
 * MCP Server Constants
 *
 * These values are fixed and not configurable to ensure protocol compliance
 * and consistent behavior across all Conduit installations.
 */

export const MCP_CONSTANTS = {
  // Protocol version - must match MCP specification
  PROTOCOL_VERSION: '2025-06-18',

  // Server endpoint path
  PATH: '/mcp',

  // Server information
  SERVER_INFO: {
    name: 'conduit-admin',
    title: 'Conduit Admin MCP Server',
    version: '1.0.0',
  },

  // Capabilities - SDK format for tools-only server
  CAPABILITIES: {
    tools: {
      listChanged: true,
    },
  },

  // Default timeouts (for backwards compatibility)
  DEFAULTS: {
    pingInterval: 30000, // 30 seconds
    sessionTimeout: 300000, // 5 minutes
  },
} as const;
