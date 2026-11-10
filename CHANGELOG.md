# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted Hyperping uptime-monitoring MCP server, serving all 69 captured tools locally for tools/list and forwarding every tools/call upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when issued).
- Tools cover monitors and healthchecks, outages and alerts, on-call schedules and escalation policies, status pages and their incidents, maintenance windows, server and log views, browser runs, and the project audit log. No payment, billing or plan tool exists in the surface.
- Upstream results pass through verbatim; upstream failures surface as `pingpulse error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). Upstream endpoint overridable via `HYPERPING_MCP_URL`; when `HYPERPING_API_KEY` is set it is sent as an `Authorization: Bearer` header.
