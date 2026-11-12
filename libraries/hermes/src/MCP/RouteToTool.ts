/**
 * Route to Tool Converter
 *
 * Converts Conduit admin routes to MCP tools automatically.
 * Generates Zod schemas and SDK-compatible handlers.
 */

import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPRouteToToolOptions, MCPSession, MCPToolDefinition } from './types.js';
import { ConduitRoute } from '../classes/index.js';
import { ConduitRouter } from '../Router.js';
import { extractClientIp } from '../utils/extractClientIp.js';
import { toErrorResponse } from '../utils/errors.js';
import { Cookie } from '../interfaces/index.js';
import { ZodParser } from '../classes/ZodParser.js';
import { CORE_MODULE } from './ToolRegistry.js';

export class RouteToToolConverter {
  constructor(private readonly router: ConduitRouter) {}

  /**
   * Convert a Conduit route to an MCP tool definition
   */
  convertRouteToTool(
    routeInfo: ConduitRoute,
    options: MCPRouteToToolOptions = {},
  ): MCPToolDefinition {
    const {
      prefix = 'admin',
      adminOnly = true,
      customDescriptions = {},
      module,
    } = options;

    const toolName = this.generateToolName(routeInfo, prefix);
    const description = this.generateDescription(routeInfo, customDescriptions, toolName);
    const inputSchema = this.generateZodSchema(routeInfo);
    const outputSchema = this.generateOutputSchema();
    const handler = this.createToolHandler(routeInfo);

    return {
      name: toolName,
      title: this.generateTitle(routeInfo),
      description,
      inputSchema,
      outputSchema,
      handler,
      adminOnly,
      module,
      // Core module tools are always enabled, others start disabled (lazy loading)
      initiallyDisabled: module !== CORE_MODULE,
    };
  }

  /**
   * Generate tool name from route information
   */
  private generateToolName(routeInfo: ConduitRoute, prefix: string): string {
    const cleanPath = routeInfo.input.path
      .replace(/^\/admin\//, '') // Remove /admin/ prefix
      .replace(/\//g, '_') // Replace slashes with underscores
      .replace(/[^a-zA-Z0-9_]/g, '') // Remove special characters
      .toLowerCase();

    const actionPrefix = routeInfo.input.action.toLowerCase();

    return `${actionPrefix}${cleanPath}`;
  }

  /**
   * Generate human-readable title for the tool
   */
  private generateTitle(routeInfo: ConduitRoute): string {
    const action = this.humanizeAction(routeInfo.input.action);
    const resource = routeInfo.input.path
      .replace(/^\/admin\//, '')
      .split('/')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return `${action} ${resource}`;
  }

  /**
   * Generate tool description
   */
  private generateDescription(
    routeInfo: ConduitRoute,
    customDescriptions: Record<string, string>,
    toolName: string,
  ): string {
    if (customDescriptions[toolName]) {
      return customDescriptions[toolName];
    }

    const action = routeInfo.input.action.toUpperCase();
    const path = routeInfo.input.path;
    const description =
      routeInfo.input.description || `${action} ${path} - Admin operation`;
    return description + this.describeErrors(routeInfo);
  }

  /** The errors a route declares, so an agent knows which conduitCodes to expect. */
  private describeErrors(routeInfo: ConduitRoute): string {
    const errors = routeInfo.input.errors;
    if (!Array.isArray(errors) || errors.length === 0) return '';
    const lines = errors.map(
      (e: { conduitCode: string; description: string }) =>
        `- ${e.conduitCode}: ${e.description}`,
    );
    return `\n\nPossible errors (error.conduitCode):\n${lines.join('\n')}`;
  }

  /**
   * Humanize HTTP action to readable verb
   */
  private humanizeAction(action: string): string {
    const actionMap: Record<string, string> = {
      GET: 'Get',
      POST: 'Create',
      PUT: 'Update',
      PATCH: 'Modify',
      DELETE: 'Delete',
    };
    return actionMap[action.toUpperCase()] || action;
  }

  /**
   * Generate Zod schema from route parameters using ZodParser
   */
  private generateZodSchema(routeInfo: ConduitRoute): Record<string, z.ZodTypeAny> {
    const parser = new ZodParser();
    const schema: Record<string, z.ZodTypeAny> = {};

    // Parse bodyParams (required by default)
    if (routeInfo.input.bodyParams) {
      const bodyResult = parser.extractTypes('body', routeInfo.input.bodyParams, true);
      Object.assign(schema, bodyResult);
    }

    // Parse queryParams (optional)
    if (routeInfo.input.queryParams) {
      const queryResult = parser.extractTypes('query', routeInfo.input.queryParams, true);
      // Mark all query params as optional
      Object.keys(queryResult).forEach(key => {
        queryResult[key] = queryResult[key].optional();
      });
      Object.assign(schema, queryResult);
    }

    // Parse urlParams (optional in schema, but present in path)
    if (routeInfo.input.urlParams) {
      const urlResult = parser.extractTypes('url', routeInfo.input.urlParams, true);
      // Mark all url params as optional
      Object.keys(urlResult).forEach(key => {
        urlResult[key] = urlResult[key].optional();
      });
      Object.assign(schema, urlResult);
    }

    return schema;
  }

  /**
   * Generate output schema for structured responses
   */
  private generateOutputSchema(): Record<string, z.ZodTypeAny> {
    return {
      success: z.boolean().describe('Whether the operation succeeded'),
      message: z.string().optional().describe('Response message'),
      data: z.any().optional().describe('Response data'),
    };
  }

  /**
   * Extract URL parameters from args based on route definition
   */
  private extractUrlParams(
    args: Record<string, unknown>,
    urlParams?: Record<string, any>,
  ): Record<string, unknown> {
    if (!urlParams) return {};

    const extracted: Record<string, unknown> = {};
    Object.keys(urlParams).forEach(key => {
      if (args.hasOwnProperty(key)) {
        extracted[key] = args[key];
      }
    });
    return extracted;
  }

  /**
   * Extract query parameters from args based on route definition
   */
  private extractQueryParams(
    args: Record<string, unknown>,
    queryParams?: Record<string, any>,
  ): Record<string, unknown> {
    if (!queryParams) return {};

    const extracted: Record<string, unknown> = {};
    Object.keys(queryParams).forEach(key => {
      if (args.hasOwnProperty(key)) {
        extracted[key] = args[key];
      }
    });
    return extracted;
  }

  /**
   * Extract body parameters from args based on route definition
   */
  private extractBodyParams(
    args: Record<string, unknown>,
    bodyParams?: Record<string, any>,
  ): Record<string, unknown> {
    if (!bodyParams) return {};

    const extracted: Record<string, unknown> = {};
    Object.keys(bodyParams).forEach(key => {
      if (args.hasOwnProperty(key)) {
        extracted[key] = args[key];
      }
    });
    return extracted;
  }

  /**
   * Create SDK-compatible tool handler
   */
  private createToolHandler(routeInfo: ConduitRoute) {
    return async (
      args: Record<string, unknown>,
      session: MCPSession,
      grpcSdk: ConduitGrpcSdk,
    ): Promise<CallToolResult> => {
      try {
        // Build context from session (populated by global middleware in admin)
        const context = {
          headers: session.headers || {},
          context: session.context || {},
          path: routeInfo.input.path,
          params: args, // Combined params
          urlParams: this.extractUrlParams(args, routeInfo.input.urlParams),
          queryParams: this.extractQueryParams(args, routeInfo.input.queryParams),
          bodyParams: this.extractBodyParams(args, routeInfo.input.bodyParams),
        };

        const ip = extractClientIp(context.headers);
        await this.router.preHandle(routeInfo.input, context, ip);

        // Execute the actual route
        const r = await routeInfo.executeRequest(context);

        if (r.setCookies && r.setCookies.length) {
          r.setCookies.forEach((cookie: Cookie) => {
            if (cookie.options.path === '') delete cookie.options.path;
            if (!cookie.options.domain || cookie.options.domain === '') {
              delete cookie.options.domain;
            }
            //todo here a cookie would be set
            //what should we do for MCP?
          });
        }
        if (r.removeCookies && r.removeCookies.length) {
          r.removeCookies.forEach((cookie: Cookie) => {
            if (cookie.options.path === '') delete cookie.options.path;
            if (!cookie.options.domain || cookie.options.domain === '') {
              delete cookie.options.domain;
            }
            //todo here a cookie would be removed
            //what should we do for MCP
          });
        }
        let result;
        if (r.redirect) {
          //todo route requests redirect
        } else {
          result = r.result ?? r;

          try {
            // Handle gRPC route responses
            result = JSON.parse(result);
          } catch {
            if (typeof result === 'string') {
              // Nest plain string responses
              result = {
                result: this.router.extractResult(
                  routeInfo.returnTypeFields as string,
                  result,
                ),
              };
            }
          }
          delete result.setCookies;
          delete result.removeCookies;
        }

        // Format as SDK CallToolResult
        const output = {
          success: true,
          message: `Executed ${routeInfo.input.action} ${routeInfo.input.path}`,
          data: result,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2),
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        const failure = toErrorResponse(error);
        ConduitGrpcSdk.Logger.error(
          `Error executing route ${routeInfo.input.path}: ${
            failure.conduitCode ? `[${failure.conduitCode}] ` : ''
          }${failure.message}`,
        );

        // Same shape as the REST error body, so an agent can branch on conduitCode.
        const output = { success: false, error: failure };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2),
            },
          ],
          structuredContent: output,
          isError: true,
        };
      }
    };
  }
}

/**
 * Standalone function to convert a single route to a tool
 * Convenience wrapper for one-off conversions
 */
export function convertConduitRouteToMCPTool(
  routeInfo: ConduitRoute,
  router: ConduitRouter,
  options: MCPRouteToToolOptions = {},
): MCPToolDefinition {
  const converter = new RouteToToolConverter(router);
  return converter.convertRouteToTool(routeInfo, options);
}
