import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * We can't import index.js directly (it connects to stdio and exits without
 * env vars), so we reconstruct the server tool registration here to test
 * the tool schema and the HTTP-calling logic with a mocked fetch.
 */

function createServer() {
  const server = new McpServer({
    name: "hateyourdeck",
    version: "1.0.0",
  });

  server.tool(
    "query_hateyourdeck",
    "Query the HateYourDeck knowledge base.",
    {
      text: z.string().describe("The question or topic to query."),
      deck_type: z.enum(["lp", "startup"]).optional().describe("Filter by deck type."),
    },
    async ({ text, deck_type }) => {
      const body = { text };
      if (deck_type) {
        body.deck_type = deck_type;
      }

      const response = await fetch("https://fake.api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test-key",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{ type: "text", text: `API error (${response.status}): ${errorText}` }],
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

      const parts = [{ type: "text", text: data.response }];

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

describe("query_hateyourdeck tool", () => {
  let client;
  let server;

  before(async () => {
    server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  after(async () => {
    await client?.close();
    await server?.close();
  });

  it("lists the query_hateyourdeck tool", async () => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "query_hateyourdeck");
  });

  it("returns response and citations on success", async (t) => {
    const mockResponse = {
      response: "Focus on the narrative arc.",
      citations: [
        {
          source_file: "frameworks.md",
          chunk_index: 0,
          content_type: "methodology",
          deck_type: "lp",
          similarity: 0.92,
          content_preview: "The LP narrative should...",
        },
      ],
      model: "us.anthropic.claude-sonnet-4-6",
      chunks_retrieved: 1,
    };

    t.mock.method(globalThis, "fetch", () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
    );

    const result = await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "How should I structure an LP narrative?" },
    });

    assert.equal(result.isError, undefined);
    assert.equal(result.content.length, 2);
    assert.ok(result.content[0].text.includes("narrative arc"));
    assert.ok(result.content[1].text.includes("frameworks.md"));
  });

  it("passes deck_type when provided", async (t) => {
    let capturedBody;

    t.mock.method(globalThis, "fetch", (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve(
        new Response(
          JSON.stringify({ response: "ok", citations: [], chunks_retrieved: 0 }),
          { status: 200 }
        )
      );
    });

    await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "test", deck_type: "startup" },
    });

    assert.equal(capturedBody.deck_type, "startup");
  });

  it("returns error on API failure", async (t) => {
    t.mock.method(globalThis, "fetch", () =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }))
    );

    const result = await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "test" },
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("401"));
  });
});
