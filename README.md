# Project Handoffs MCP Server

MCP server for managing AI session handoffs and next steps tracking.

## Core Concepts

- NextStep → WorkingSession → Handoff → New NextStep chains
- Project-based organization
- Priority levels mapped to implementation impact:
  - core-critical: Critical for working implementation
  - full-required: Necessary for desired implementation
  - enhancement: Improvements and optimizations

## Available Tools

- `list_templates` - List available templates for next steps, working sessions, and handoffs
- `create_project` - Create a new project for tracking AI session handoffs
- `delete_project` - Delete a project and all its data
- `create_next_step` - Create a new next step in a project
- `start_working_session` - Start working on a next step
- `create_handoff` - Complete a working session with handoff details
- `get_latest_next_steps` - Get open next steps ordered by priority
- `get_next_step_history` - Get complete history of a next step including session and handoff

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "project-handoffs": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/path/to/project-handoffs/build/index.js"],
      "alwaysAllow": []
    }
  }
}
```

## Project Structure

```
project-handoffs/
├── src/
│   ├── index.ts           # Server implementation
│   ├── templates.ts       # Entity templates
│   ├── types.ts          # TypeScript types
│   └── errors.ts         # Error handling
├── package.json          
└── README.md
```

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build


## Implementation Details

- Error handling through ProjectError class
- Template validation for all entity types
- Consistent state management
- Safe data persistence with proper error handling
- Type-safe implementation following project-memory-server patterns

## Security

If you discover a security vulnerability, please create a new issue with the label 'security'. We take all security reports seriously and will respond promptly.

## Contributing

Contributions are welcome. Feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.