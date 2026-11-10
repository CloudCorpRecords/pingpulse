import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  callTool,
  createClient,
  DEFAULT_ENDPOINT_URL,
  isKnownTool,
  parseRpcBody,
  PingpulseClient,
  PROTOCOL_VERSION,
  TOOL_DEFS,
  TOOL_NAMES,
  VERSION,
} from "../src/forward.js";
import { handleCallTool } from "../src/mcp.js";
import type {
  FetchFn,
  FetchResponseLike,
  ToolDef,
  ToolResult,
} from "../src/types.js";

/**
 * All tests run against a stubbed JSON-RPC upstream that
 * implements the streamable-HTTP session flow
 * (initialize -> notifications/initialized -> tools/call):
 * no live network, and the real Hyperping endpoint is
 * never contacted.
 */

const FIXTURE_URL = new URL(
  "../../../harness/fixtures/hyperping-tools-original.json",
  import.meta.url,
);
const FIXTURE_AVAILABLE = existsSync(FIXTURE_URL);
const fixture = (
  FIXTURE_AVAILABLE
    ? JSON.parse(readFileSync(FIXTURE_URL, "utf-8"))
    : { tools: [] }
) as {
  tools: ToolDef[];
};
/**
 * Publish-survival guard (Wave 25 preflight, proven Wave 24 pattern):
 * the parity fixture lives in the build harness, outside the published
 * repo tree, so fixture-dependent tests skip cleanly when it is absent;
 * with the fixture present they run in full, with no skips.
 */
function skipWithoutFixture(t: {
  skip: (message: string) => void;
}): boolean {
  if (FIXTURE_AVAILABLE) return false;
  t.skip("parity fixture lives in the build harness, not the repo tree");
  return true;
}


const LIST_TOOL = "list_monitors";
const GET_TOOL = "get_monitor";
const CREATE_TOOL = "create_monitor";
const SUMMARY_TOOL = "get_status_summary";

const EXPECTED_NAMES = [
  "list_monitors", "get_monitor", "create_monitor", "update_monitor",
  "pause_monitor", "resume_monitor", "search_monitors_by_name",
  "get_status_summary", "list_outages", "get_outage", "get_outage_timeline",
  "get_monitor_outages", "create_outage", "acknowledge_outage",
  "escalate_outage", "resolve_outage", "list_recent_alerts",
  "get_monitor_uptime", "get_monitor_response_time", "get_monitor_mttr",
  "get_monitor_mtta", "get_monitor_anomalies", "get_monitor_http_logs",
  "list_on_call_schedules", "get_on_call_schedule", "list_escalation_policies",
  "get_escalation_policy", "list_team_members", "get_on_call_now",
  "list_integrations", "get_integration", "list_status_pages",
  "get_status_page", "create_status_page", "update_status_page",
  "add_status_page_services", "remove_status_page_services",
  "list_status_page_incidents", "get_status_page_incident",
  "create_status_page_incident", "add_status_page_incident_update",
  "resolve_status_page_incident", "update_status_page_incident",
  "edit_status_page_incident_update", "list_maintenance_windows",
  "get_maintenance_window", "create_maintenance_window",
  "update_maintenance_window", "complete_maintenance_window",
  "cancel_maintenance_window", "search_logs", "get_outage_logs",
  "summarize_log_errors", "list_log_dashboards", "run_log_chart",
  "create_log_dashboard_from_template", "get_outage_checks",
  "find_correlated_outages", "get_recent_changes", "run_check_now",
  "list_healthchecks", "get_healthcheck", "list_servers", "get_server",
  "list_audit_log", "get_project_report", "get_outage_alerts",
  "list_browser_runs", "get_browser_run",
];

const SAMPLE_RESULT = {
  content: [{ type: "text", text: "{\"monitors\":[],\"count\":0}" }],
  structuredContent: { count: 0 },
};

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface FakeOptions {
  callResult?: Record<string, unknown>;
  callBodyText?: string;
  callError?: Record<string, unknown>;
  callStatus?: number;
  initError?: Record<string, unknown>;
  throwOn?: "initialize" | "tools/call";
  sessionId?: string | null;
  hangOnCall?: boolean;
  sse?: boolean;
}

function makeResponse(
  status: number,
  bodyText: string,
  headers: Record<string, string> = {},
): FetchResponseLike {
  const lowered = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lowered.get(name.toLowerCase()) ?? null },
    text: async () => bodyText,
  };
}

function jsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  return makeResponse(status, JSON.stringify(payload), headers);
}

function makeUpstream(options: FakeOptions = {}): {
  fetchFn: FetchFn;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    calls.push({ url, headers: init?.headers ?? {}, body });
    const method = body.method as string;
    if (options.throwOn === method) throw new Error("socket hang up");
    if (method === "initialize") {
      if (options.initError !== undefined) {
        return jsonResponse(200, {
          jsonrpc: "2.0",
          id: body.id,
          error: options.initError,
        });
      }
      const headers: Record<string, string> = {};
      const sessionId =
        options.sessionId === undefined ? "sess-xyz" : options.sessionId;
      if (sessionId !== null) headers["mcp-session-id"] = sessionId;
      return jsonResponse(
        200,
        {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            serverInfo: { name: "hyperping", version: "1.0.0" },
          },
        },
        headers,
      );
    }
    if (method === "notifications/initialized") {
      return makeResponse(202, "");
    }
    if (method === "tools/call") {
      if (options.hangOnCall) {
        return new Promise<FetchResponseLike>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new Error("aborted"));
              return;
            }
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }
        });
      }
      if (options.callBodyText !== undefined) {
        return makeResponse(options.callStatus ?? 200, options.callBodyText);
      }
      if (options.callError !== undefined) {
        return jsonResponse(200, {
          jsonrpc: "2.0",
          id: body.id,
          error: options.callError,
        });
      }
      const result = options.callResult ?? SAMPLE_RESULT;
      const payload = { jsonrpc: "2.0", id: body.id, result };
      if (options.sse) {
        return makeResponse(
          200,
          `event: message\ndata: ${JSON.stringify(payload)}\n\n`,
        );
      }
      return jsonResponse(options.callStatus ?? 200, payload);
    }
    return jsonResponse(200, {});
  };
  return { fetchFn, calls };
}

function stubClient(options: FakeOptions = {}, extra: Record<string, unknown> = {}) {
  const upstream = makeUpstream(options);
  const c = new PingpulseClient({
    fetchFn: upstream.fetchFn,
    env: {},
    ...extra,
  });
  return { client: c, calls: upstream.calls };
}

function textOf(result: ToolResult): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0].text;
}

function methods(calls: Captured[]): string[] {
  return calls.map((c) => c.body.method as string);
}

function requiredOf(name: string): string[] | undefined {
  const tool = TOOL_DEFS.find((t) => t.name === name);
  assert.ok(tool, `tool ${name} exists`);
  return (tool.inputSchema as { required?: string[] }).required;
}

/* ------------------------------------------------------------------ */

describe("registration integrity (captured surface)", () => {
  it("serves exactly the fixture's 69 tools, deep-equal, in order", (t) => {
    if (skipWithoutFixture(t)) return;
    assert.equal(fixture.tools.length, 69);
    assert.deepEqual(TOOL_DEFS, fixture.tools);
  });

  it("serves the 69 tool names in fixture order", (t) => {
    if (skipWithoutFixture(t)) return;
    assert.deepEqual(TOOL_NAMES, EXPECTED_NAMES);
    assert.deepEqual(TOOL_NAMES, fixture.tools.map((t) => t.name));
  });

  it("carries exactly the fixture's keys on each tool", () => {
    for (const tool of TOOL_DEFS) {
      assert.deepEqual(Object.keys(tool).sort(), [
        "description",
        "inputSchema",
        "name",
        "title",
      ]);
    }
  });

  it("carries the title keys, as captured", (t) => {
    if (skipWithoutFixture(t)) return;
    assert.equal(TOOL_DEFS[0].title, "List monitors");
    assert.equal(TOOL_DEFS[1].title, "Get monitor");
    assert.equal(TOOL_DEFS[2].title, "Create monitor");
    for (let i = 0; i < 69; i += 1) {
      assert.equal(TOOL_DEFS[i].title, fixture.tools[i].title);
      assert.equal(typeof TOOL_DEFS[i].title, "string");
    }
  });

  it("carries exactly the fixture's required fields per tool, for all 69", (t) => {
    if (skipWithoutFixture(t)) return;
    for (let i = 0; i < 69; i += 1) {
      const served = (TOOL_DEFS[i].inputSchema as { required?: string[] }).required;
      const expected = (fixture.tools[i].inputSchema as { required?: string[] }).required;
      assert.deepEqual(served, expected, TOOL_DEFS[i].name);
      assert.equal(
        "required" in (TOOL_DEFS[i].inputSchema as object),
        "required" in (fixture.tools[i].inputSchema as object),
        TOOL_DEFS[i].name,
      );
    }
  });

  it("matches the spec's required-fields summary on representative tools", () => {
    assert.deepEqual(requiredOf("get_monitor"), ["uuid"]);
    assert.deepEqual(requiredOf("create_monitor"), ["name", "url"]);
    assert.deepEqual(requiredOf("search_monitors_by_name"), ["query"]);
    assert.deepEqual(requiredOf("get_monitor_outages"), ["monitor_uuid"]);
    assert.deepEqual(requiredOf("create_outage"), ["description"]);
    assert.deepEqual(requiredOf("create_status_page"), ["name", "subdomain"]);
    assert.deepEqual(requiredOf("add_status_page_services"), ["uuid", "services"]);
    assert.deepEqual(requiredOf("create_status_page_incident"), ["title", "message", "status_pages"]);
    assert.deepEqual(requiredOf("add_status_page_incident_update"), ["uuid", "message", "status"]);
    assert.deepEqual(requiredOf("resolve_status_page_incident"), ["uuid", "message"]);
    assert.deepEqual(requiredOf("edit_status_page_incident_update"), ["uuid", "update_uuid"]);
    assert.deepEqual(requiredOf("create_maintenance_window"), ["name", "start_date", "end_date", "monitors"]);
    assert.deepEqual(requiredOf("create_log_dashboard_from_template"), ["template_id"]);
    assert.deepEqual(requiredOf("list_browser_runs"), ["uuid"]);
    assert.deepEqual(requiredOf("get_browser_run"), ["uuid"]);
  });

  it("serves NO invented required key on the 26 NOKEY tools", () => {
    const nokey = TOOL_DEFS.filter(
      (t) => !("required" in (t.inputSchema as object)),
    );
    assert.equal(nokey.length, 26);
    assert.deepEqual(
      nokey.map((t) => t.name),
      [
        "list_monitors", "get_status_summary", "list_outages",
        "list_recent_alerts", "get_monitor_uptime",
        "get_monitor_response_time", "get_monitor_mttr", "get_monitor_mtta",
        "list_on_call_schedules", "list_escalation_policies",
        "list_team_members", "get_on_call_now", "list_integrations",
        "list_status_pages", "list_status_page_incidents",
        "list_maintenance_windows", "search_logs", "summarize_log_errors",
        "list_log_dashboards", "run_log_chart", "find_correlated_outages",
        "get_recent_changes", "list_healthchecks", "list_servers",
        "list_audit_log", "get_project_report",
      ],
    );
  });

  it("get_status_summary carries exactly the captured bare schema", () => {
    const tool = TOOL_DEFS.find((t) => t.name === SUMMARY_TOOL);
    assert.ok(tool);
    assert.deepEqual(tool.inputSchema, {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {},
    });
    assert.equal("required" in (tool.inputSchema as object), false);
    assert.equal("additionalProperties" in (tool.inputSchema as object), false);
  });

  it("carries every fixture property, in order, for all 69 tools", (t) => {
    if (skipWithoutFixture(t)) return;
    for (let i = 0; i < 69; i += 1) {
      const served = Object.keys(
        (TOOL_DEFS[i].inputSchema as { properties: object }).properties,
      );
      const expected = Object.keys(
        (fixture.tools[i].inputSchema as { properties: object }).properties,
      );
      assert.deepEqual(served, expected, TOOL_DEFS[i].name);
    }
    assert.deepEqual(
      Object.keys((TOOL_DEFS[0].inputSchema as { properties: object }).properties),
      ["status", "page", "limit"],
    );
  });

  it("carries the fixture's list_monitors constraints verbatim", () => {
    const props = (
      TOOL_DEFS[0].inputSchema as {
        properties: Record<string, Record<string, unknown>>;
      }
    ).properties;
    assert.equal(props.status.type, "string");
    assert.deepEqual(props.status.enum, ["up", "down", "paused", "ssl_expiring"]);
    assert.equal(props.page.type, "integer");
    assert.equal(props.page.minimum, 0);
    assert.equal(props.limit.minimum, 1);
    assert.equal(props.limit.maximum, 200);
  });

  it("isKnownTool recognises built tools and rejects others", () => {
    assert.equal(isKnownTool(LIST_TOOL), true);
    assert.equal(isKnownTool("get_project_report"), true);
    assert.equal(isKnownTool("list_monitors_extra"), false);
    assert.equal(isKnownTool(""), false);
  });
});

/* ------------------------------------------------------------------ */

describe("session establishment and reuse", () => {
  it("runs initialize, notifications/initialized, then tools/call in order", async () => {
    const { client: c, calls } = stubClient();
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, undefined);
    assert.deepEqual(methods(calls), [
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    assert.ok(calls.every((call) => call.url === DEFAULT_ENDPOINT_URL));
    assert.equal(DEFAULT_ENDPOINT_URL, "https://api.hyperping.io/v1/mcp");
    for (const call of calls) {
      assert.equal(call.headers["Content-Type"], "application/json");
      assert.equal(call.headers["Accept"], "application/json, text/event-stream");
    }
    assert.equal(calls[0].headers["Mcp-Session-Id"], undefined);
    assert.equal(calls[1].headers["Mcp-Session-Id"], "sess-xyz");
    assert.equal(calls[2].headers["Mcp-Session-Id"], "sess-xyz");
  });

  it("sends clientInfo name pingpulse and the pinned protocol version on initialize", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(GET_TOOL, { uuid: "mon_1" });
    const initParams = calls[0].body.params as Record<string, unknown>;
    assert.equal(initParams.protocolVersion, PROTOCOL_VERSION);
    assert.equal(PROTOCOL_VERSION, "2025-03-26");
    assert.deepEqual(initParams.capabilities, {});
    assert.deepEqual(initParams.clientInfo, { name: "pingpulse", version: VERSION });
  });

  it("establishes the session lazily once and reuses it on later calls", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LIST_TOOL, {});
    await c.callTool(SUMMARY_TOOL, {});
    assert.deepEqual(methods(calls), [
      "initialize",
      "notifications/initialized",
      "tools/call",
      "tools/call",
    ]);
    assert.equal(calls[3].headers["Mcp-Session-Id"], "sess-xyz");
    assert.notEqual(calls[2].body.id, calls[3].body.id);
  });

  it("sends no session header when the upstream issues none", async () => {
    const { client: c, calls } = stubClient({ sessionId: null });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, undefined);
    assert.ok(calls.every((call) => call.headers["Mcp-Session-Id"] === undefined));
  });

  it("honours the HYPERPING_MCP_URL env override", async () => {
    const upstream = makeUpstream();
    const c = new PingpulseClient({
      fetchFn: upstream.fetchFn,
      env: { HYPERPING_MCP_URL: "https://staging.example.com/v1/mcp" },
    });
    await c.callTool(LIST_TOOL, {});
    assert.ok(
      upstream.calls.every((call) => call.url === "https://staging.example.com/v1/mcp"),
    );
  });

  it("honours an explicit url override over the default endpoint", async () => {
    const upstream = makeUpstream();
    const c = createClient({
      fetchFn: upstream.fetchFn,
      env: {},
      url: "https://alt.example.com/mcp",
    });
    await c.callTool(GET_TOOL, { uuid: "mon_7" });
    assert.ok(upstream.calls.every((call) => call.url === "https://alt.example.com/mcp"));
  });

  it("prefers an explicit url override over the env override", async () => {
    const upstream = makeUpstream();
    const c = createClient({
      fetchFn: upstream.fetchFn,
      env: { HYPERPING_MCP_URL: "https://env.example.com/mcp" },
      url: "https://explicit.example.com/mcp",
    });
    await c.callTool(LIST_TOOL, {});
    assert.ok(
      upstream.calls.every((call) => call.url === "https://explicit.example.com/mcp"),
    );
  });

  it("falls back to the pinned endpoint when the env override is blank", async () => {
    const upstream = makeUpstream();
    const c = new PingpulseClient({
      fetchFn: upstream.fetchFn,
      env: { HYPERPING_MCP_URL: "   " },
    });
    await c.callTool(LIST_TOOL, {});
    assert.ok(upstream.calls.every((call) => call.url === DEFAULT_ENDPOINT_URL));
  });
});

/* ------------------------------------------------------------------ */

describe("upstream key header", () => {
  it("sends Authorization: Bearer on every request when HYPERPING_API_KEY is set", async () => {
    const upstream = makeUpstream();
    const c = new PingpulseClient({
      fetchFn: upstream.fetchFn,
      env: { HYPERPING_API_KEY: "hp-key-42" },
    });
    await c.callTool(LIST_TOOL, {});
    assert.equal(upstream.calls.length, 3);
    assert.ok(
      upstream.calls.every(
        (call) => call.headers["Authorization"] === "Bearer hp-key-42",
      ),
    );
  });

  it("sends no Authorization header when HYPERPING_API_KEY is unset", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(LIST_TOOL, {});
    assert.ok(calls.every((call) => call.headers["Authorization"] === undefined));
  });

  it("never sends an X-API-Key header, with or without a key", async () => {
    const withKey = makeUpstream();
    const c1 = new PingpulseClient({
      fetchFn: withKey.fetchFn,
      env: { HYPERPING_API_KEY: "hp-key-42" },
    });
    await c1.callTool(LIST_TOOL, {});
    assert.ok(withKey.calls.every((call) => call.headers["X-API-Key"] === undefined));
    const { client: c2, calls } = stubClient();
    await c2.callTool(LIST_TOOL, {});
    assert.ok(calls.every((call) => call.headers["X-API-Key"] === undefined));
  });
});

/* ------------------------------------------------------------------ */

describe("tools/call forwarding", () => {
  it("forwards a list call verbatim", async () => {
    const { client: c, calls } = stubClient();
    const args = { status: "down", page: 1, limit: 10 };
    await c.callTool(LIST_TOOL, args);
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, LIST_TOOL);
    assert.deepEqual(params.arguments, args);
  });

  it("forwards a get call verbatim", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(GET_TOOL, { uuid: "mon_abc" });
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, GET_TOOL);
    assert.deepEqual(params.arguments, { uuid: "mon_abc" });
  });

  it("forwards a create call verbatim", async () => {
    const { client: c, calls } = stubClient();
    const args = { name: "API", url: "https://example.com/health" };
    await c.callTool(CREATE_TOOL, args);
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, CREATE_TOOL);
    assert.deepEqual(params.arguments, args);
  });

  it("forwards an empty-arguments summary call verbatim", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(SUMMARY_TOOL, {});
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, SUMMARY_TOOL);
    assert.deepEqual(params.arguments, {});
  });

  it("passes the upstream result through verbatim, including extra fields", async () => {
    const { client: c } = stubClient();
    const out = await c.callTool(LIST_TOOL, {});
    assert.deepEqual(out, SAMPLE_RESULT);
  });

  it("passes an upstream isError result through untouched", async () => {
    const upstreamResult = {
      content: [{ type: "text", text: "monitor not found" }],
      isError: true,
    };
    const { client: c } = stubClient({ callResult: upstreamResult });
    const out = await c.callTool(GET_TOOL, { uuid: "mon_missing" });
    assert.deepEqual(out, upstreamResult);
  });

  it("reads an SSE-framed tools/call response", async () => {
    const { client: c } = stubClient({ sse: true });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, undefined);
    assert.deepEqual(out, SAMPLE_RESULT);
  });

  it("the one-shot callTool helper forwards under the right tool name", async () => {
    const upstream = makeUpstream();
    const out = await callTool(
      GET_TOOL,
      { uuid: "mon_42" },
      { fetchFn: upstream.fetchFn, env: {} },
    );
    assert.equal(out.isError, undefined);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, GET_TOOL);
    assert.deepEqual(params.arguments, { uuid: "mon_42" });
  });
});

/* ------------------------------------------------------------------ */

describe("upstream failures surface as pingpulse error text", () => {
  it("maps a JSON-RPC error to `pingpulse error: <message>`", async () => {
    const { client: c } = stubClient({
      callError: { code: -32000, message: "monitor lookup failed upstream" },
    });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "pingpulse error: monitor lookup failed upstream");
  });

  it("maps an initialize JSON-RPC error to pingpulse error text", async () => {
    const { client: c } = stubClient({
      initError: { code: -32600, message: "bad initialize" },
    });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "pingpulse error: bad initialize");
  });

  it("maps an unparseable upstream response to a malformed-response error", async () => {
    const { client: c } = stubClient({ callBodyText: "<html>oops</html>" });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "pingpulse error: malformed response");
  });

  it("maps a response with no result object to a malformed-response error", async () => {
    const { client: c } = stubClient({
      callBodyText: '{"jsonrpc":"2.0","id":3,"result":null}',
    });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "pingpulse error: malformed response");
  });

  it("maps a non-2xx upstream status to pingpulse error text", async () => {
    const { client: c } = stubClient({ callBodyText: "internal error", callStatus: 500 });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "pingpulse error: HTTP 500");
  });

  it("maps a throwing fetch to pingpulse error text", async () => {
    const { client: c } = stubClient({ throwOn: "tools/call" });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.match(textOf(out), /^pingpulse error: /);
  });

  it("maps a throwing initialize fetch to pingpulse error text", async () => {
    const { client: c } = stubClient({ throwOn: "initialize" });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "pingpulse error: socket hang up");
  });

  it("maps a timed-out call to pingpulse error text", async () => {
    const { client: c } = stubClient({ hangOnCall: true }, { timeoutMs: 20 });
    const out = await c.callTool(LIST_TOOL, {});
    assert.equal(out.isError, true);
    assert.match(textOf(out), /^pingpulse error: /);
  });
});

/* ------------------------------------------------------------------ */

describe("parseRpcBody", () => {
  it("parses plain JSON and picks the message with the matching id", () => {
    const body = '{"jsonrpc":"2.0","id":7,"result":{"ok":true}}';
    assert.deepEqual(parseRpcBody(body, 7), {
      jsonrpc: "2.0",
      id: 7,
      result: { ok: true },
    });
  });

  it("parses SSE data lines", () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n';
    assert.deepEqual(parseRpcBody(body, 2), {
      jsonrpc: "2.0",
      id: 2,
      result: { ok: true },
    });
  });

  it("picks the matching id among several SSE messages", () => {
    const body =
      'data: {"jsonrpc":"2.0","id":1,"result":{"n":1}}\n\n' +
      'data: {"jsonrpc":"2.0","id":2,"result":{"n":2}}\n\n';
    assert.deepEqual(parseRpcBody(body, 2), {
      jsonrpc: "2.0",
      id: 2,
      result: { n: 2 },
    });
  });

  it("ignores the SSE [DONE] sentinel", () => {
    const body =
      'data: {"jsonrpc":"2.0","id":4,"result":{"ok":true}}\ndata: [DONE]\n';
    assert.deepEqual(parseRpcBody(body, 4), {
      jsonrpc: "2.0",
      id: 4,
      result: { ok: true },
    });
  });

  it("returns null for empty and unparseable bodies", () => {
    assert.equal(parseRpcBody(""), null);
    assert.equal(parseRpcBody("not json at all"), null);
    assert.equal(parseRpcBody("[1,2,3]"), null);
  });
});

/* ------------------------------------------------------------------ */

describe("MCP layer validation", () => {
  it("rejects an unknown tool with MethodNotFound before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(
      () => handleCallTool(c, "not_a_tool", {}),
      (err: unknown) =>
        err instanceof McpError && err.code === ErrorCode.MethodNotFound,
    );
    assert.equal(upstream.calls.length, 0);
  });

  it("rejects array arguments with InvalidParams before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(
      () => handleCallTool(c, LIST_TOOL, ["nope"]),
      (err: unknown) =>
        err instanceof McpError && err.code === ErrorCode.InvalidParams,
    );
    assert.equal(upstream.calls.length, 0);
  });

  it("rejects string arguments with InvalidParams before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(
      () => handleCallTool(c, GET_TOOL, "uuid=mon_1"),
      (err: unknown) =>
        err instanceof McpError && err.code === ErrorCode.InvalidParams,
    );
    assert.equal(upstream.calls.length, 0);
  });

  it("forwards a valid list call through the MCP layer unchanged", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, LIST_TOOL, { status: "up" });
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.deepEqual(params.arguments, { status: "up" });
  });

  it("forwards a valid get call through the MCP layer unchanged", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, GET_TOOL, { uuid: "mon_42" });
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, GET_TOOL);
  });

  it("treats omitted arguments as an empty object", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, SUMMARY_TOOL, undefined);
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.deepEqual(params.arguments, {});
  });
});

/* ------------------------------------------------------------------ */

describe("CLI", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

  function runCli(args: string[]) {
    return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
    });
  }

  it("--version prints 0.1.0 and exits 0", () => {
    const res = runCli(["--version"]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout.trim(), "0.1.0");
    assert.equal(res.stdout.trim(), VERSION);
  });

  it("-v prints 0.1.0 and exits 0", () => {
    const res = runCli(["-v"]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout.trim(), "0.1.0");
  });

  it("an unknown command prints usage on stderr and exits 2", () => {
    const res = runCli(["not-a-tool"]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Usage:/);
  });

  it("a non-JSON argument exits 2", () => {
    const res = runCli([LIST_TOOL, "not json"]);
    assert.equal(res.status, 2);
  });

  it("a JSON array argument exits 2", () => {
    const res = runCli([LIST_TOOL, "[]"]);
    assert.equal(res.status, 2);
  });

  it("extra arguments after mcp exit 2", () => {
    const res = runCli(["mcp", "extra"]);
    assert.equal(res.status, 2);
  });
});
