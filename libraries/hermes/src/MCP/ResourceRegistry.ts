/**
 * Resource Registry for MCP Server
 *
 * Manages MCP resources - read-only data exposed to MCP clients.
 * Resources are used to provide documentation, schemas, and other
 * reference data to AI agents.
 *
 * Definitions are stored here; each HTTP request calls populateServer() on a fresh McpServer.
 *
 * Key resources:
 * - Admin API Swagger/OpenAPI specification
 * - Client/Router API OpenAPI specification
 * - API usage guide explaining the difference between APIs
 */

import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { McpServer, ResourceMetadata } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPResourceDefinition, SwaggerDocProvider } from './types.js';

/** Resource URI prefix for Conduit documentation */
export const RESOURCE_URI_PREFIX = 'conduit://docs';

/** Standard resource URIs */
export const RESOURCE_URIS = {
  ADMIN_SWAGGER: `${RESOURCE_URI_PREFIX}/admin-api/swagger`,
  CLIENT_SWAGGER: `${RESOURCE_URI_PREFIX}/client-api/swagger`,
  API_GUIDE: `${RESOURCE_URI_PREFIX}/api-guide`,
} as const;

export class ResourceRegistry {
  /** All registered resource definitions */
  private _resources: Map<string, MCPResourceDefinition> = new Map();

  /** Provider for Admin API Swagger documentation */
  private _adminSwaggerProvider: SwaggerDocProvider | null = null;

  /** Provider for Client/Router API Swagger documentation */
  private _clientSwaggerProvider: SwaggerDocProvider | null = null;

  /** API guide content (markdown) */
  private _apiGuideContent: string = '';

  constructor(_grpcSdk: ConduitGrpcSdk) {
    // grpcSdk reserved for future use (e.g. dynamic resources)
  }

  /**
   * Set the provider for Admin API Swagger documentation
   */
  setAdminSwaggerProvider(provider: SwaggerDocProvider): void {
    this._adminSwaggerProvider = provider;
    this.registerDefaultResources();
  }

  /**
   * Set the provider for Client/Router API Swagger documentation
   */
  setClientSwaggerProvider(provider: SwaggerDocProvider): void {
    this._clientSwaggerProvider = provider;
    this.registerDefaultResources();
  }

  /**
   * Set the API guide content
   */
  setApiGuideContent(content: string): void {
    this._apiGuideContent = content;
    this.registerDefaultResources();
  }

  /**
   * Register default documentation resources (definitions only)
   */
  private registerDefaultResources(): void {
    if (this._adminSwaggerProvider && !this._resources.has(RESOURCE_URIS.ADMIN_SWAGGER)) {
      this._resources.set(RESOURCE_URIS.ADMIN_SWAGGER, {
        uri: RESOURCE_URIS.ADMIN_SWAGGER,
        name: 'Admin API OpenAPI Specification',
        description:
          'Complete OpenAPI 3.0 specification for the Conduit Admin API. ' +
          'All MCP tools in this server correspond to Admin API endpoints. ' +
          'Use these endpoints with admin tokens (Bearer) or masterkey header.',
        mimeType: 'application/json',
        contentProvider: () => {
          const doc = this._adminSwaggerProvider?.();
          return doc ? JSON.stringify(doc, null, 2) : '{}';
        },
      });
      ConduitGrpcSdk.Logger.log(
        `Registered MCP resource definition: ${RESOURCE_URIS.ADMIN_SWAGGER}`,
      );
    }

    if (
      this._clientSwaggerProvider &&
      !this._resources.has(RESOURCE_URIS.CLIENT_SWAGGER)
    ) {
      this._resources.set(RESOURCE_URIS.CLIENT_SWAGGER, {
        uri: RESOURCE_URIS.CLIENT_SWAGGER,
        name: 'Client/Router API OpenAPI Specification',
        description:
          'Complete OpenAPI 3.0 specification for the Conduit Client/Router API. ' +
          'These endpoints are NOT available through this MCP server. ' +
          'Use HTTP client (fetch/axios) with user tokens for these operations.',
        mimeType: 'application/json',
        contentProvider: () => {
          const doc = this._clientSwaggerProvider?.();
          return doc ? JSON.stringify(doc, null, 2) : '{}';
        },
      });
      ConduitGrpcSdk.Logger.log(
        `Registered MCP resource definition: ${RESOURCE_URIS.CLIENT_SWAGGER}`,
      );
    }

    if (this._apiGuideContent && !this._resources.has(RESOURCE_URIS.API_GUIDE)) {
      this._resources.set(RESOURCE_URIS.API_GUIDE, {
        uri: RESOURCE_URIS.API_GUIDE,
        name: 'Conduit API Usage Guide',
        description:
          'Quick reference guide explaining the difference between Admin and Client APIs, ' +
          'authentication requirements, and when to use each.',
        mimeType: 'text/markdown',
        contentProvider: () => this._apiGuideContent,
      });
      ConduitGrpcSdk.Logger.log(
        `Registered MCP resource definition: ${RESOURCE_URIS.API_GUIDE}`,
      );
    }
  }

  /**
   * Register all resource definitions on a per-request McpServer instance.
   */
  populateServer(mcpServer: McpServer): void {
    for (const resource of this._resources.values()) {
      const metadata: ResourceMetadata = {
        description: resource.description,
        mimeType: resource.mimeType,
      };

      mcpServer.registerResource(resource.name, resource.uri, metadata, async () => {
        const content = await Promise.resolve(resource.contentProvider());
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType,
              text: content,
            },
          ],
        };
      });
    }
  }

  /**
   * Register a resource definition (public API)
   */
  registerResource(resource: MCPResourceDefinition): void {
    this._resources.set(resource.uri, resource);
    ConduitGrpcSdk.Logger.log(`Registered MCP resource definition: ${resource.uri}`);
  }

  /**
   * Unregister a resource from the registry
   */
  unregisterResource(uri: string): boolean {
    const removed = this._resources.delete(uri);
    if (removed) {
      ConduitGrpcSdk.Logger.log(`Unregistered MCP resource: ${uri}`);
    }
    return removed;
  }

  /**
   * Get a resource by URI
   */
  getResource(uri: string): MCPResourceDefinition | undefined {
    return this._resources.get(uri);
  }

  /**
   * List all registered resources
   */
  listResources(): MCPResourceDefinition[] {
    return Array.from(this._resources.values());
  }

  /**
   * Get the count of registered resources
   */
  getResourceCount(): number {
    return this._resources.size;
  }

  /**
   * Clear all registered resources
   */
  clearAllResources(): void {
    this._resources.clear();
    ConduitGrpcSdk.Logger.log('Cleared all MCP resources');
  }
}
