/**
 * API Guide Content for MCP Resources
 *
 * This markdown content is exposed as an MCP resource to help AI agents
 * understand the difference between Admin and Client APIs.
 */

export const API_GUIDE_CONTENT = `# Conduit API Guide

## MCP Server Context

This MCP server connects to the **Conduit Admin API** only. The Admin API is designed for administrative operations and powers the Conduit Admin Panel.

**Authentication is already handled** - all MCP tools execute with admin privileges. You do not need to provide credentials when using MCP tools.

## Available Tools

The MCP server exposes a **subset of Admin API tools** at any given time. Conduit has many modules, and tools are organized by module to keep the context manageable.

- Use \`list_modules\` to discover available modules
- Modules can be enabled via URL query: \`/mcp?modules=authentication,storage\`
- Consult the Admin API Swagger (\`conduit://docs/admin-api/swagger\`) to see all available endpoints and request specific modules be enabled

## Client API for Applications

The Client API is separate from the Admin API and is **not accessible through this MCP server**. It is designed for applications to consume.

The Client API is not limited to database and authentication. **All Conduit modules** expose endpoints through the Client API:
- Authentication (login, registration, OAuth)
- Database (CMS content access)
- Storage (file uploads/downloads)
- Email, SMS, Push notifications
- And more depending on enabled modules

When building application code that calls Conduit, use HTTP requests to the Client API with appropriate user authentication (user tokens obtained through the authentication module).

## Response Format Differences

The two APIs return data in different formats optimized for their consumers:

- **Admin API**: Responses are structured for the Admin Panel UI (e.g., paginated lists with metadata, detailed error information)
- **Client API**: Responses are structured for application consumption (e.g., direct document access, streamlined payloads)

Do not assume response formats are interchangeable between the two APIs.

## When to Use Each

| Task | Use |
|------|-----|
| Schema management, user administration, module configuration | MCP tools (Admin API) |
| End-user authentication, content retrieval, file operations | HTTP client to Client API |
| Discovering all available admin operations | Fetch Admin API Swagger resource |
| Building application features | Client API with user tokens |
`;
