/**
 * MCP Controller - Official SDK Implementation
 *
 * Implements Model Context Protocol server using the official TypeScript SDK
 * with Streamable HTTP transport as defined in MCP specification 2025-06-18.
 *
 * Key features:
 * - Stateless transport (new transport per request)
 * - HTTP POST for client-to-server messages
 * - HTTP GET for server-to-client SSE streams
 * - Admin authentication required
 * - Origin validation for security
 * - Automatic admin route to tool conversion
 * - Module-based tool organization with lazy loading
 */

import { NextFunction, Request, Response } from 'express';
import { ConduitRouter } from '../Router.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCPConfig, MCPToolDefinition, SwaggerDocProvider } from './types.js';
import { CORE_MODULE, ToolRegistry } from './ToolRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';
import { MCP_ERROR_CODES } from './MCPErrors.js';
import { convertConduitRouteToMCPTool } from './RouteToTool.js';
import { ConduitRoute } from '../classes/index.js';
import { isNil } from 'lodash-es';
import { registerMetaTools } from './MetaTools.js';

export class MCPController extends ConduitRouter {
  private _mcpServer: McpServer;
  private _toolRegistry: ToolRegistry;
  private _resourceRegistry: ResourceRegistry;
  private _config: MCPConfig;
  private _grpcSdk: ConduitGrpcSdk;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    config: MCPConfig,
    private readonly metrics?: {
      registeredRoutes?: {
        name: string;
      };
    },
  ) {
    super(grpcSdk);
    this._grpcSdk = grpcSdk;
    this._config = config;

    // Initialize MCP server with SDK
    this._mcpServer = new McpServer({
      name: this._config.serverInfo.name,
      title: this._config.serverInfo.title,
      version: this._config.serverInfo.version,
    });

    // Initialize tool registry
    this._toolRegistry = new ToolRegistry(grpcSdk);
    this._toolRegistry.setMcpServer(this._mcpServer);

    // Initialize resource registry
    this._resourceRegistry = new ResourceRegistry(grpcSdk);
    this._resourceRegistry.setMcpServer(this._mcpServer);

    // Register meta-tools for module discovery (always enabled)
    registerMetaTools(this._toolRegistry);

    this.initializeRouter();
  }

  initializeRouter() {
    this.createRouter();
    this.setupRoutes();
  }

  private setupRoutes() {
    if (!this._expressRouter) return;

    // OPTIONS for CORS preflight
    this._expressRouter.options(this._config.path, this.handleOptions.bind(this));

    // Health check endpoint (register before main GET route to ensure correct matching)
    this._expressRouter.get(
      `${this._config.path}/health`,
      this.handleHealthCheck.bind(this),
    );

    // POST endpoint for MCP messages (required by Streamable HTTP spec)
    this._expressRouter.post(this._config.path, this.handleMCPRequest.bind(this));

    // GET endpoint for SSE streams (required by Streamable HTTP spec)
    this._expressRouter.get(this._config.path, this.handleMCPRequest.bind(this));
  }

  /**
   * Handle CORS preflight requests
   */
  private handleOptions(req: Request, res: Response) {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Origin, MCP-Protocol-Version',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).send();
  }

  /**
   * Parse modules from URL query parameters
   * Extracts comma-separated module names from ?modules= query parameter
   * @param req - Express request object
   * @returns Array of module names, or empty array if not specified
   */
  private parseModulesFromQuery(req: Request): string[] {
    const modulesParam = req.query.modules;

    if (!modulesParam) {
      return [];
    }

    // Handle both string and array formats
    const modulesString =
      typeof modulesParam === 'string'
        ? modulesParam
        : Array.isArray(modulesParam)
          ? modulesParam.join(',')
          : '';

    if (!modulesString) {
      return [];
    }

    // Split by comma and trim whitespace
    const modules = modulesString
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    return modules;
  }

  /**
   * Enable modules specified in URL query parameters
   * Validates module names against available modules
   * @param moduleNames - Array of module names from query parameter
   */
  private enableModulesFromQuery(moduleNames: string[]): void {
    if (moduleNames.length === 0) {
      return;
    }

    // Get available modules for validation
    const availableModules = this._toolRegistry.getModules();
    const availableModuleNames = new Set(availableModules.map(m => m.name));

    // Filter to only valid modules
    const validModules = moduleNames.filter(moduleName => {
      if (availableModuleNames.has(moduleName)) {
        return true;
      }
      ConduitGrpcSdk.Logger.warn(
        `Unknown module specified in URL: ${moduleName}. Available modules: ${Array.from(
          availableModuleNames,
        ).join(', ')}`,
      );
      return false;
    });

    if (validModules.length > 0) {
      // Enable modules (only if not already enabled for efficiency)
      const modulesToEnable = validModules.filter(
        m => !this._toolRegistry.isModuleLoaded(m),
      );

      if (modulesToEnable.length > 0) {
        this._toolRegistry.enableModules(modulesToEnable);
        ConduitGrpcSdk.Logger.log(
          `Enabled modules from URL query: ${modulesToEnable.join(', ')}`,
        );
      }
    }
  }

  /**
   * Handle MCP POST and GET requests with stateless transport
   * Creates a new transport for each request to prevent request ID collisions
   * - POST: Client-to-server messages (with JSON-RPC body)
   * - GET: Server-to-client SSE streams (no body)
   *
   * Supports URL-based module specification via ?modules= query parameter
   * Example: /mcp?modules=authentication,storage
   */
  private async handleMCPRequest(req: Request, res: Response, next: NextFunction) {
    try {
      // Parse and enable modules from query parameters
      const requestedModules = this.parseModulesFromQuery(req);
      if (requestedModules.length > 0) {
        this.enableModulesFromQuery(requestedModules);
      }

      // Create stateless transport (new instance per request)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true,
      });

      // Clean up transport when response closes
      res.on('close', () => {
        transport.close();
      });

      // Connect server to transport (creates new session internally)
      await this._mcpServer.connect(transport);

      // Handle the request
      // For GET requests, pass undefined as body (GET doesn't have a request body)
      // For POST requests, pass req.body which contains the JSON-RPC message
      const body = req.method === 'GET' ? undefined : req.body;
      await transport.handleRequest(req, res, body);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(
        'Error handling MCP request: ' + (error as Error).message,
      );

      // Only send error response if headers haven't been sent
      if (!res.headersSent) {
        const message = req.body;
        res.status(500).json({
          jsonrpc: '2.0',
          id: message?.id || null,
          error: {
            code: MCP_ERROR_CODES.INTERNAL_ERROR,
            message: error instanceof Error ? error.message : 'Internal server error',
          },
        });
      }
    }
  }

  /**
   * Health check endpoint
   */
  private handleHealthCheck(req: Request, res: Response) {
    const modules = this._toolRegistry.getModules();
    const resources = this._resourceRegistry.listResources();
    res.json({
      status: 'healthy',
      protocol: 'mcp',
      version: this._config.protocolVersion,
      serverInfo: this._config.serverInfo,
      tools: {
        total: this._toolRegistry.getToolCount(),
        enabled: this._toolRegistry.getEnabledToolCount(),
      },
      resources: {
        total: resources.length,
        list: resources.map(r => ({ uri: r.uri, name: r.name })),
      },
      modules: {
        total: modules.length,
        loaded: this._toolRegistry.getLoadedModules().length,
        list: modules,
      },
      uptime: process.uptime(),
    });
  }

  /**
   * Extract module name from route path
   * e.g., "/authentication/local/login" -> "authentication"
   * e.g., "/storage/file/:id" -> "storage"
   * e.g., "/config" -> "core"
   */
  private extractModuleFromPath(path: string): string {
    // Remove leading slash and split by /
    const segments = path.replace(/^\//, '').split('/');

    // First segment is the module name
    const firstSegment = segments[0];

    // If path is just a single segment or empty, use core module
    if (!firstSegment || segments.length === 1) {
      return CORE_MODULE;
    }

    // Skip common prefixes that aren't module names
    if (firstSegment === 'admin' || firstSegment === 'hook') {
      // Use second segment as module
      return segments[1] || CORE_MODULE;
    }

    return firstSegment;
  }

  /**
   * Register a tool with the MCP server
   */
  registerTool(tool: MCPToolDefinition): void {
    this._toolRegistry.registerTool(tool);
  }

  /**
   * Register a Conduit route as an MCP tool (following ConduitRouter pattern)
   */
  registerConduitRoute(route: ConduitRoute): void {
    if (!this.routeChanged(route)) return; // Inherited from ConduitRouter
    // do not register any router that isn't requested
    if (!isNil(route.input.mcp) && !route.input.mcp) return;

    const key = `${route.input.action}-${route.input.path}`;
    const registered = this._registeredRoutes.has(key);
    this._registeredRoutes.set(key, route);

    if (!registered) {
      // First time registration
      this.registerRouteAsTool(route);
      if (this.metrics?.registeredRoutes) {
        ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
          transport: 'mcp',
        });
      }
    }
    // If already registered and changed, refresh will handle it
  }

  /**
   * Register a Conduit admin route as an MCP tool
   */
  registerRouteAsTool(route: ConduitRoute): void {
    // Extract module from route path
    const moduleName = this.extractModuleFromPath(route.input.path);

    // Convert route to tool with module info
    const tool = convertConduitRouteToMCPTool(route, this, { module: moduleName });
    this.registerTool(tool);
  }

  // Override ConduitRouter methods
  protected _refreshRouter() {
    // Clear module tools but preserve meta-tools
    this._toolRegistry.clearModuleTools();

    // Re-register all tools from registered routes
    this._registeredRoutes.forEach(route => {
      this.registerRouteAsTool(route);
    });

    ConduitGrpcSdk.Logger.log(
      `MCP tools refreshed: ${this._registeredRoutes.size} module tools + meta-tools`,
    );
  }

  /**
   * Clean up routes that are no longer registered
   * Updates _registeredRoutes and triggers refresh to rebuild tools
   */
  cleanupRoutes(routes: { action: string; path: string }[]): void {
    // Base class cleanupRoutes updates _registeredRoutes
    // Then calls refreshRouter() which triggers our _refreshRouter()
    const newRegisteredRoutes: Map<string, ConduitRoute> = new Map();
    routes.forEach(route => {
      const key = `${route.action}-${route.path}`;
      if (this._registeredRoutes.has(key)) {
        newRegisteredRoutes.set(key, this._registeredRoutes.get(key)!);
      }
    });

    this._registeredRoutes.clear();
    this._registeredRoutes = newRegisteredRoutes;
    this.refreshRouter(); // Triggers _refreshRouter after delay
  }

  /**
   * Get the tool registry (for testing/debugging)
   */
  getToolRegistry(): ToolRegistry {
    return this._toolRegistry;
  }

  /**
   * Get the resource registry (for testing/debugging)
   */
  getResourceRegistry(): ResourceRegistry {
    return this._resourceRegistry;
  }

  /**
   * Set the Admin API Swagger documentation provider
   * This enables the Admin API OpenAPI spec resource
   */
  setAdminSwaggerProvider(provider: SwaggerDocProvider): void {
    this._resourceRegistry.setAdminSwaggerProvider(provider);
  }

  /**
   * Set the Client/Router API Swagger documentation provider
   * This enables the Client API OpenAPI spec resource
   */
  setClientSwaggerProvider(provider: SwaggerDocProvider): void {
    this._resourceRegistry.setClientSwaggerProvider(provider);
  }

  /**
   * Set the API guide content (markdown)
   * This enables the API guide resource
   */
  setApiGuideContent(content: string): void {
    this._resourceRegistry.setApiGuideContent(content);
  }

  shutDown() {
    ConduitGrpcSdk.Logger.log('Shutting down MCP controller');
    super.shutDown();
  }
}
