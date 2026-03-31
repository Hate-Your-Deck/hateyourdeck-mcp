# HateYourDeck MCP Server

MCP server that connects Claude Desktop to the HateYourDeck knowledge base. Exposes a single tool (`query_hateyourdeck`) that queries Mike Lightman's pitch deck methodology.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Claude Desktop](https://claude.ai/download)
- A HateYourDeck API key

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Hate-Your-Deck/hateyourdeck-mcp.git
cd hateyourdeck-mcp
npm install
```

### 2. Configure Claude Desktop

Open your Claude Desktop config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following (replace the paths and API key):

**Windows:**

```json
{
  "mcpServers": {
    "hateyourdeck": {
      "command": "node",
      "args": ["C:\\Users\\YOUR_USERNAME\\hateyourdeck-mcp\\index.js"],
      "env": {
        "HYD_API_URL": "https://t5ejdq60n1.execute-api.us-east-1.amazonaws.com",
        "HYD_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**Mac:**

```json
{
  "mcpServers": {
    "hateyourdeck": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/hateyourdeck-mcp/index.js"],
      "env": {
        "HYD_API_URL": "https://t5ejdq60n1.execute-api.us-east-1.amazonaws.com",
        "HYD_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Quit and reopen Claude Desktop. The `query_hateyourdeck` tool will appear automatically.

## Usage

Just chat normally in Claude Desktop. When you ask about pitch decks, Claude will use the tool to pull guidance from the knowledge base.

Example prompts:
- "How should I structure this LP narrative?"
- "What are common anti-patterns in startup decks?"
- "Review this slide structure for a fundraising deck"

## Tool Reference

### `query_hateyourdeck`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Your question or topic |
| `deck_type` | `"lp"` or `"startup"` | No | Filter to a specific deck type |

Returns the AI-generated response plus source citations from the knowledge base.
