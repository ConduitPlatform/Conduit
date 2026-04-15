/**
 * MCP Controller - Official SDK Implementation
 *
 * Implements Model Context Protocol server using the official TypeScript SDK
 * with Streamable HTTP transport as defined in MCP specification 2025-06-18.
 *
 * Key features:
 * - Stateless transport and a fresh McpServer per request (one SDK transport per Protocol)
 * - HTTP POST for client-to-server messages
 * - HTTP GET for server-to-client SSE streams
 * - Admin authentication required
 * - Origin validation for security
 * - Automatic admin route to tool conversion
 * - Module-based tool organization with lazy loading
 */

import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ConduitRouter } from '../Router.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { MCPConfig, MCPSession, MCPToolDefinition, SwaggerDocProvider } from './types.js';
import { CORE_MODULE, ToolRegistry } from './ToolRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';
import { MCP_ERROR_CODES } from './MCPErrors.js';
import { convertConduitRouteToMCPTool } from './RouteToTool.js';
import { ConduitRoute } from '../classes/index.js';
import { isNil } from 'lodash-es';
import { registerMetaTools } from './MetaTools.js';
import { MCP_CONSTANTS } from './constants.js';
import { ConduitRequest } from '../interfaces/ConduitRequest.js';

export class MCPController extends ConduitRouter {
  /** Module name -> list of module names to enable (e.g. communications -> email, push, sms) */
  private static readonly MODULE_ALIASES: Record<string, string[]> = {
    communications: ['email', 'push', 'sms'],
  };

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

    // Initialize tool registry (definitions only; each request builds a new McpServer)
    this._toolRegistry = new ToolRegistry(grpcSdk);

    // Initialize resource registry
    this._resourceRegistry = new ResourceRegistry(grpcSdk);

    // Register meta-tools for module discovery (always enabled)
    registerMetaTools(this._toolRegistry);

    this.initializeRouter();
  }

  initializeRouter() {
    this.createRouter();
    this.setupRoutes();
  }

  /** New SDK server instance per HTTP request (Protocol allows one transport per instance). */
  private createMcpServer(): McpServer {
    return new McpServer(
      {
        name: this._config.serverInfo.name,
        title: this._config.serverInfo.title,
        version: this._config.serverInfo.version,
      },
      {
        instructions: MCP_CONSTANTS.INSTRUCTIONS,
        capabilities: this._config.capabilities,
      },
    );
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
  private handleOptions(req: ExpressRequest, res: ExpressResponse) {
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
  private parseModulesFromQuery(req: ExpressRequest): string[] {
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

    // Expand module aliases (e.g. "communications" -> ["email", "push", "sms"])
    const expandedModules = moduleNames.flatMap(
      m => MCPController.MODULE_ALIASES[m] ?? [m],
    );

    // Get available modules for validation
    const availableModules = this._toolRegistry.getModules();
    const availableModuleNames = new Set(availableModules.map(m => m.name));

    // Filter to only valid modules
    const validModules = expandedModules.filter(moduleName => {
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

  private buildMCPSessionFromRequest(req: ExpressRequest): MCPSession {
    const conduit = (req as ConduitRequest).conduit;
    const headers: Record<string, string | string[] | undefined> = { ...req.headers };
    const context: Record<string, unknown> =
      conduit && typeof conduit === 'object' ? { ...conduit } : {};
    return {
      headers,
      context,
      authenticated: Boolean(context.admin),
    };
  }

  private expressToWebRequest(req: ExpressRequest): globalThis.Request {
    const host = req.get('host') ?? 'localhost';
    const proto = req.protocol ?? 'http';
    const url = `${proto}://${host}${req.originalUrl}`;
    return new globalThis.Request(url, {
      method: req.method,
      headers: new Headers(req.headers as HeadersInit),
    });
  }

  private async logMcpTransportErrorResponse(
    webResponse: globalThis.Response,
  ): Promise<void> {
    if (webResponse.status < 400) return;
    const ct = webResponse.headers.get('content-type') ?? '';
    const clone = webResponse.clone();
    try {
      if (ct.includes('application/json') || ct.includes('text/plain')) {
        const text = await clone.text();
        ConduitGrpcSdk.Logger.warn(
          `MCP Web transport error response ${webResponse.status}: ${text.slice(0, 4000)}`,
        );
      } else {
        ConduitGrpcSdk.Logger.warn(
          `MCP Web transport error response ${webResponse.status} content-type=${ct}`,
        );
      }
    } catch (e) {
      ConduitGrpcSdk.Logger.warn(
        `MCP Web transport error response ${webResponse.status} (body read failed: ${(e as Error).message})`,
      );
    }
  }

  private async sendWebResponseToExpress(
    webResponse: globalThis.Response,
    res: ExpressResponse,
  ): Promise<void> {
    if (res.headersSent) {
      ConduitGrpcSdk.Logger.warn(
        'MCP: sendWebResponseToExpress called after Express headers were already sent',
      );
      return;
    }

    res.status(webResponse.status);

    const skip = new Set(['content-encoding', 'transfer-encoding']);
    webResponse.headers.forEach((value, key) => {
      if (skip.has(key.toLowerCase())) return;
      try {
        if (key.toLowerCase() === 'set-cookie') {
          res.appendHeader(key, value);
        } else {
          res.setHeader(key, value);
        }
      } catch {
        /* invalid header name/value */
      }
    });

    if (!webResponse.body) {
      res.end();
      return;
    }

    const readable = Readable.fromWeb(
      webResponse.body as import('stream/web').ReadableStream<Uint8Array>,
    );
    try {
      await pipeline(readable, res);
    } catch (err) {
      ConduitGrpcSdk.Logger.error(
        'MCP: error piping Web Response to Express: ' + (err as Error).message,
      );
      if (!res.writableEnded) {
        res.destroy(err as Error);
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
  private async handleMCPRequest(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ) {
    try {
      const requestedModules = this.parseModulesFromQuery(req);
      if (requestedModules.length > 0) {
        this.enableModulesFromQuery(requestedModules);
      }

      const enabledModules = this._toolRegistry.getLoadedModulesFull();
      const requestSession = this.buildMCPSessionFromRequest(req);

      const mcpServer = this.createMcpServer();
      this._toolRegistry.populateServer(mcpServer, enabledModules, requestSession);
      this._resourceRegistry.populateServer(mcpServer);

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true,
      });

      transport.onerror = (err: Error) => {
        ConduitGrpcSdk.Logger.error(
          'MCP WebStandardStreamableHTTPServerTransport error: ' +
            (err?.message ?? String(err)),
        );
      };

      res.on('close', () => {
        void transport.close();
      });

      await mcpServer.connect(transport);

      const body = req.method === 'GET' ? undefined : req.body;
      const webRequest = this.expressToWebRequest(req);
      const webResponse = await transport.handleRequest(webRequest, {
        parsedBody: body,
      });

      await this.logMcpTransportErrorResponse(webResponse);
      await this.sendWebResponseToExpress(webResponse, res);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      ConduitGrpcSdk.Logger.error(
        'Error handling MCP request: ' +
          err.message +
          (err.stack ? '\n' + err.stack : ''),
      );
      if (!res.headersSent) {
        const message = req.body;
        res.status(500).json({
          jsonrpc: '2.0',
          id: message?.id || null,
          error: {
            code: MCP_ERROR_CODES.INTERNAL_ERROR,
            message: err.message,
          },
        });
      }
    }
  }

  /**
   * Health check endpoint
   */
  private handleHealthCheck(req: ExpressRequest, res: ExpressResponse) {
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
    if (
      firstSegment === 'admin' ||
      firstSegment === 'hook' ||
      firstSegment === 'config'
    ) {
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
