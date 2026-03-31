import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 30_000;

export function createServer(apiUrl, apiKey) {
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

      let response;
      try {
        response = await fetch(`${apiUrl}/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: err.name === "TimeoutError"
                ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
                : `Network error: ${err.message}`,
            },
          ],
          isError: true,
        };
      }

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch {
          errorText = "unable to read error response";
        }
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

      let data;
      try {
        data = await response.json();
      } catch {
        return {
          content: [
            {
              type: "text",
              text: "Failed to parse API response as JSON",
            },
          ],
          isError: true,
        };
      }

      const responseText = data.response ?? "No response returned from API";

      const citations = data.citations
        ?.map(
          (c, i) =>
            `[${i + 1}] ${c.source_file} (${c.content_type}, ${c.deck_type}, similarity: ${c.similarity})\n    ${c.content_preview}`
        )
        .join("\n");

      const parts = [
        { type: "text", text: responseText },
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

  return server;
}

const isMainModule = !process.argv[1] || import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const apiUrl = process.env.HYD_API_URL;
  const apiKey = process.env.HYD_API_KEY;

  if (!apiUrl) {
    console.error("HYD_API_URL environment variable is required");
    process.exit(1);
  }

  if (!apiKey) {
    console.error("HYD_API_KEY environment variable is required");
    process.exit(1);
  }

  const server = createServer(apiUrl, apiKey);
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
  } catch (err) {
    console.error("Failed to start MCP server:", err.message);
    process.exit(1);
  }
}
