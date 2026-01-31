/**
 * Resource Registry for MCP Server
 *
 * Manages MCP resources - read-only data exposed to MCP clients.
 * Resources are used to provide documentation, schemas, and other
 * reference data to AI agents.
 *
 * Key resources:
 * - Admin API Swagger/OpenAPI specification
 * - Client/Router API Swagger/OpenAPI specification
 * - API usage guide explaining the difference between APIs
 */

import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  McpServer,
  RegisteredResource,
  ResourceMetadata,
} from '@modelcontextprotocol/sdk/server/mcp.js';
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

  /** SDK RegisteredResource handles for enable/disable/remove operations */
  private _resourceHandles: Map<string, RegisteredResource> = new Map();

  private _grpcSdk: ConduitGrpcSdk;
  private _mcpServer: McpServer | null = null;

  /** Provider for Admin API Swagger documentation */
  private _adminSwaggerProvider: SwaggerDocProvider | null = null;

  /** Provider for Client/Router API Swagger documentation */
  private _clientSwaggerProvider: SwaggerDocProvider | null = null;

  /** API guide content (markdown) */
  private _apiGuideContent: string = '';

  constructor(grpcSdk: ConduitGrpcSdk) {
    this._grpcSdk = grpcSdk;
  }

  /**
   * Set the MCP server instance
   */
  setMcpServer(server: McpServer): void {
    this._mcpServer = server;
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
   * Register default documentation resources
   */
  private registerDefaultResources(): void {
    if (!this._mcpServer) return;

    // Register Admin API Swagger resource if provider is available
    if (
      this._adminSwaggerProvider &&
      !this._resourceHandles.has(RESOURCE_URIS.ADMIN_SWAGGER)
    ) {
      this.registerResourceWithSDK({
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
    }

    // Register Client API Swagger resource if provider is available
    if (
      this._clientSwaggerProvider &&
      !this._resourceHandles.has(RESOURCE_URIS.CLIENT_SWAGGER)
    ) {
      this.registerResourceWithSDK({
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
    }

    // Register API guide resource if content is available
    if (this._apiGuideContent && !this._resourceHandles.has(RESOURCE_URIS.API_GUIDE)) {
      this.registerResourceWithSDK({
        uri: RESOURCE_URIS.API_GUIDE,
        name: 'Conduit API Usage Guide',
        description:
          'Quick reference guide explaining the difference between Admin and Client APIs, ' +
          'authentication requirements, and when to use each.',
        mimeType: 'text/markdown',
        contentProvider: () => this._apiGuideContent,
      });
    }
  }

  /**
   * Register a resource with the MCP SDK
   */
  private registerResourceWithSDK(resource: MCPResourceDefinition): void {
    if (!this._mcpServer) {
      throw new Error('MCP server not initialized. Call setMcpServer() first.');
    }

    // Remove existing resource if it exists
    if (this._resourceHandles.has(resource.uri)) {
      const existingHandle = this._resourceHandles.get(resource.uri);
      existingHandle?.remove();
      this._resourceHandles.delete(resource.uri);
    }

    // Store the resource definition
    this._resources.set(resource.uri, resource);

    // Build metadata for SDK
    const metadata: ResourceMetadata = {
      description: resource.description,
      mimeType: resource.mimeType,
    };

    // Register with SDK
    const handle = this._mcpServer.registerResource(
      resource.name,
      resource.uri,
      metadata,
      async () => {
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
      },
    );

    // Store the handle
    this._resourceHandles.set(resource.uri, handle);
    ConduitGrpcSdk.Logger.log(`Registered MCP resource: ${resource.uri}`);
  }

  /**
   * Register a resource with the registry (public API)
   */
  registerResource(resource: MCPResourceDefinition): void {
    this.registerResourceWithSDK(resource);
  }

  /**
   * Unregister a resource from the registry
   */
  unregisterResource(uri: string): boolean {
    const handle = this._resourceHandles.get(uri);
    if (handle) {
      handle.remove();
      this._resourceHandles.delete(uri);
    }

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
    // Remove all resources from SDK
    this._resourceHandles.forEach(handle => {
      handle.remove();
    });
    this._resourceHandles.clear();
    this._resources.clear();
    ConduitGrpcSdk.Logger.log('Cleared all MCP resources');
  }
}
