import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../index.js";

describe("query_hateyourdeck tool", () => {
  let client;
  let server;

  before(async () => {
    server = createServer("https://fake.api", "test-key");
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

  it("returns error on malformed JSON response", async (t) => {
    t.mock.method(globalThis, "fetch", () =>
      Promise.resolve(new Response("not json", { status: 200 }))
    );

    const result = await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "test" },
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Failed to parse"));
  });

  it("handles missing response field gracefully", async (t) => {
    t.mock.method(globalThis, "fetch", () =>
      Promise.resolve(
        new Response(JSON.stringify({ citations: [], chunks_retrieved: 0 }), { status: 200 })
      )
    );

    const result = await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "test" },
    });

    assert.equal(result.isError, undefined);
    assert.ok(result.content[0].text.includes("No response returned"));
  });

  it("returns error on network failure", async (t) => {
    t.mock.method(globalThis, "fetch", () =>
      Promise.reject(new Error("ECONNREFUSED"))
    );

    const result = await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "test" },
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Network error"));
  });

  it("returns error on timeout", async (t) => {
    const timeoutErr = new DOMException("Signal timed out", "TimeoutError");
    t.mock.method(globalThis, "fetch", () => Promise.reject(timeoutErr));

    const result = await client.callTool({
      name: "query_hateyourdeck",
      arguments: { text: "test" },
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("timed out"));
  });
});
