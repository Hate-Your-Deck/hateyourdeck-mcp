import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.HYD_API_URL;
const API_KEY = process.env.HYD_API_KEY;

if (!API_URL) {
  console.error("HYD_API_URL environment variable is required");
  process.exit(1);
}

if (!API_KEY) {
  console.error("HYD_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "hateyourdeck",
  version: "1.0.0",
});

server.tool(
  "query_hateyourdeck",
  "Query the HateYourDeck knowledge base for pitch deck review guidance based on Mike Lightman's methodology. Returns strategic advice grounded in real transcripts and frameworks.",
  {
    text: z.string().describe("The question or topic to query — e.g. 'How should I structure an LP narrative?' or 'What are common anti-patterns in startup decks?'"),
    deck_type: z.enum(["lp", "startup"]).optional().describe("Filter results to a specific deck type. Omit to search all."),
  },
  async ({ text, deck_type }) => {
    const body = { text };
    if (deck_type) {
      body.deck_type = deck_type;
    }

    const response = await fetch(`${API_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [
          {
            type: "text",
            text: `API error (${response.status}): ${errorText}`,
          },
        ],
        isError: true,
      };
    }

    const data = await response.json();

    const citations = data.citations
      ?.map(
        (c, i) =>
          `[${i + 1}] ${c.source_file} (${c.content_type}, ${c.deck_type}, similarity: ${c.similarity})\n    ${c.content_preview}`
      )
      .join("\n");

    const parts = [
      { type: "text", text: data.response },
    ];

    if (citations) {
      parts.push({
        type: "text",
        text: `\n---\n**Sources (${data.chunks_retrieved} chunks retrieved):**\n${citations}`,
      });
    }

    return { content: parts };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
