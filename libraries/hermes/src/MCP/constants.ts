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

  // Capabilities - SDK format for tools and resources server
  CAPABILITIES: {
    tools: {
      listChanged: true,
    },
    resources: {
      listChanged: true,
    },
  },

  // Instructions sent to MCP clients during initialize (protocol 2025-06-18)
  INSTRUCTIONS: `This server exposes Conduit Admin API tools organized by module. Only the "core" and "__meta__" modules are enabled by default.

Module discovery and activation:
- Call list_modules first to see all available modules and which are currently loaded.
- Modules are enabled via the ?modules= query parameter on the MCP server URL (e.g. /mcp?modules=authentication,database,storage). The client/user must configure this URL; you cannot change it at runtime.
- If a module you need is not loaded, instruct the user to update their MCP server URL to include ?modules= followed by the needed module names (comma-separated).

Common modules:
- database: schemas, documents, custom endpoints, indexes
- authentication: users, teams, OAuth services
- storage: file storage configuration
- authorization: relations, resources, permission checks (RBAC/ReBAC)
- chat: rooms and messages management
- communications: email sending/templates, push notifications, SMS (alias for email,push,sms). You can use ?modules=communications or ?modules=email,push,sms
- admin: admin panel settings
- core: always enabled; config, admins, API tokens, health

Configuration:
- get_config returns the full config for all modules. When a module is enabled, you also get get_config_<module> and patch_config_<module> to read and update that module's configuration. Use patch_config_<module> with a "config" body to change settings; the user does not need to edit config files manually.`,

  // Default timeouts (for backwards compatibility)
  DEFAULTS: {
    pingInterval: 30000, // 30 seconds
    sessionTimeout: 300000, // 5 minutes
  },
} as const;
