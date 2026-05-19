import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

// MCP Error Codes
export const MCP_ERROR_CODES = {
  // JSON-RPC 2.0 Standard Errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // MCP-Specific Errors
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32002,
  TOOL_NOT_FOUND: -32003,
  TOOL_EXECUTION_ERROR: -32004,
  SESSION_NOT_FOUND: -32005,
  CAPABILITY_NOT_SUPPORTED: -32006,
  PROTOCOL_VERSION_MISMATCH: -32007,
  AUTHENTICATION_FAILED: -32008,
  RATE_LIMIT_EXCEEDED: -32009,
  CONNECTION_LOST: -32010,
} as const;

export class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'MCPError';
  }

  toJSONRPCError(id: string | number) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: this.code,
        message: this.message,
        data: this.data,
      },
    };
  }
}

// Specific error classes for different error types
export class MCPAuthenticationError extends MCPError {
  constructor(message: string = 'Authentication failed', data?: unknown) {
    super(MCP_ERROR_CODES.AUTHENTICATION_FAILED, message, data);
    this.name = 'MCPAuthenticationError';
  }
}

export class MCPAuthorizationError extends MCPError {
  constructor(message: string = 'Access forbidden', data?: unknown) {
    super(MCP_ERROR_CODES.FORBIDDEN, message, data);
    this.name = 'MCPAuthorizationError';
  }
}

export class MCPToolNotFoundError extends MCPError {
  constructor(toolName: string) {
    super(MCP_ERROR_CODES.TOOL_NOT_FOUND, `Tool '${toolName}' not found`);
    this.name = 'MCPToolNotFoundError';
  }
}

export class MCPToolExecutionError extends MCPError {
  constructor(toolName: string, originalError: Error) {
    super(
      MCP_ERROR_CODES.TOOL_EXECUTION_ERROR,
      `Tool '${toolName}' execution failed: ${originalError.message}`,
      { originalError: originalError.message, stack: originalError.stack },
    );
    this.name = 'MCPToolExecutionError';
  }
}

export class MCPSessionError extends MCPError {
  constructor(sessionId: string, message: string = 'Session not found') {
    super(MCP_ERROR_CODES.SESSION_NOT_FOUND, message, { sessionId });
    this.name = 'MCPSessionError';
  }
}

export class MCPCapabilityError extends MCPError {
  constructor(capability: string) {
    super(
      MCP_ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
      `Capability '${capability}' not supported`,
    );
    this.name = 'MCPCapabilityError';
  }
}

export class MCPProtocolError extends MCPError {
  constructor(version: string, supportedVersion: string) {
    super(
      MCP_ERROR_CODES.PROTOCOL_VERSION_MISMATCH,
      `Protocol version '${version}' not supported. Supported version: '${supportedVersion}'`,
      { requestedVersion: version, supportedVersion },
    );
    this.name = 'MCPProtocolError';
  }
}

export class MCPRateLimitError extends MCPError {
  constructor(limit: number, window: number) {
    super(
      MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded: ${limit} requests per ${window}ms`,
      { limit, window },
    );
    this.name = 'MCPRateLimitError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(sessionId: string, reason: string = 'Connection lost') {
    super(
      MCP_ERROR_CODES.CONNECTION_LOST,
      `Connection lost for session ${sessionId}: ${reason}`,
      { sessionId, reason },
    );
    this.name = 'MCPConnectionError';
  }
}

// Error handler utility
export class MCPErrorHandler {
  static handle(
    error: unknown,
    requestId?: string | number,
  ): {
    jsonrpc: '2.0';
    id?: string | number;
    error: {
      code: number;
      message: string;
      data?: unknown;
    };
  } {
    ConduitGrpcSdk.Logger.error('MCP Error: ' + String(error));

    if (error instanceof MCPError) {
      return {
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: error.code,
          message: error.message,
          data: error.data,
        },
      };
    }

    if (error instanceof Error) {
      return {
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: MCP_ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal server error',
          data: {
            originalError: error.message,
            stack: error.stack,
          },
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: MCP_ERROR_CODES.INTERNAL_ERROR,
        message: 'Unknown error occurred',
        data: { error: String(error) },
      },
    };
  }

  static isRetryableError(error: unknown): boolean {
    if (error instanceof MCPError) {
      // Some errors are retryable, others are not
      const retryableCodes: number[] = [
        MCP_ERROR_CODES.CONNECTION_LOST,
        MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      ];
      return retryableCodes.includes(error.code);
    }
    return false;
  }

  static getRetryDelay(error: unknown): number {
    if (error instanceof MCPRateLimitError) {
      // Return the rate limit window as retry delay
      return (error.data as any)?.window || 60000; // Default 1 minute
    }

    if (error instanceof MCPConnectionError) {
      return 5000; // 5 seconds for connection errors
    }

    return 1000; // Default 1 second
  }
}

// Error logging utility
export class MCPErrorLogger {
  static logError(error: MCPError, context?: Record<string, unknown>): void {
    const logMessage = `MCP Error: ${error.name} (code: ${error.code}) - ${error.message}`;
    const logDataStr = context ? ` | Context: ${JSON.stringify(context)}` : '';

    if (error.code >= MCP_ERROR_CODES.INTERNAL_ERROR) {
      ConduitGrpcSdk.Logger.error(logMessage + logDataStr);
    } else {
      ConduitGrpcSdk.Logger.warn(logMessage + logDataStr);
    }
  }

  static logToolExecutionError(
    toolName: string,
    error: Error,
    sessionId: string,
    args?: Record<string, unknown>,
  ): void {
    const logMessage = `MCP Tool Execution Error: ${toolName} (session: ${sessionId}) - ${error.message}`;
    const argsStr = args ? ` | Args: ${JSON.stringify(args)}` : '';
    ConduitGrpcSdk.Logger.error(logMessage + argsStr);
  }

  static logAuthenticationError(
    reason: string,
    sessionId?: string,
    userAgent?: string,
  ): void {
    const logMessage = `MCP Authentication Error: ${reason}`;
    const detailsStr = sessionId ? ` | Session: ${sessionId}` : '';
    const uaStr = userAgent ? ` | UA: ${userAgent}` : '';
    ConduitGrpcSdk.Logger.warn(logMessage + detailsStr + uaStr);
  }
}

// Error recovery utility
export class MCPErrorRecovery {
  static async recoverFromError(
    error: unknown,
    context: {
      sessionId: string;
      toolName?: string;
      retryCount?: number;
    },
  ): Promise<boolean> {
    const { sessionId, toolName, retryCount = 0 } = context;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      ConduitGrpcSdk.Logger.error(
        `Max retries exceeded for session ${sessionId}, tool: ${toolName}`,
      );
      return false;
    }

    if (!MCPErrorHandler.isRetryableError(error)) {
      return false;
    }

    const delay = MCPErrorHandler.getRetryDelay(error);
    ConduitGrpcSdk.Logger.log(
      `Retrying in ${delay}ms for session ${sessionId}, attempt ${retryCount + 1}`,
    );

    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }
}
