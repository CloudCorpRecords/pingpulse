# BUILD REPORT — pingpulse

Rebuild of `com.hyperping/hyperping` v1.0.0 (remote-only)
as `@reneturcios/pingpulse` 0.1.0 / `io.github.CloudCorpRecords/pingpulse`.
**All 69 captured tools built — the batch's largest surface, no subset.**

## Fixture conflicts

**None.** The spec's required-fields summary was cross-checked
line by line against the fixture
(`harness/fixtures/hyperping-tools-original.json`): all 69 tool
names in order and every required list (including every NOKEY
marking) agree exactly. The fixture's tool literals (name, title,
description, inputSchema — including the `title` key on every
tool, the `$schema` and `additionalProperties` keys where the
capture carries them, and the bare `{$schema, type, properties}`
schema on `get_status_summary`, `list_on_call_schedules`,
`list_escalation_policies`, `list_team_members` and
`list_integrations`) are served verbatim from `src/forward.ts`;
the literals were generated programmatically from the fixture
JSON (parsed and re-serialised by `/tmp/b38-pingpulse-gen.py`,
never retyped) and verified by the registration-integrity test
(served tools/list deep-equals the fixture's 69 tool objects, in
order) and again by the parity harness.

### Required fields as served (from the fixture)

- `list_monitors` — NO `required` key (NOKEY)
- `get_monitor` — `uuid`
- `create_monitor` — `name`, `url`
- `update_monitor` — `uuid`
- `pause_monitor` — `uuid`
- `resume_monitor` — `uuid`
- `search_monitors_by_name` — `query`
- `get_status_summary` — NO `required` key (NOKEY)
- `list_outages` — NO `required` key (NOKEY)
- `get_outage` — `uuid`
- `get_outage_timeline` — `uuid`
- `get_monitor_outages` — `monitor_uuid`
- `create_outage` — `description`
- `acknowledge_outage` — `uuid`
- `escalate_outage` — `uuid`
- `resolve_outage` — `uuid`
- `list_recent_alerts` — NO `required` key (NOKEY)
- `get_monitor_uptime` — NO `required` key (NOKEY)
- `get_monitor_response_time` — NO `required` key (NOKEY)
- `get_monitor_mttr` — NO `required` key (NOKEY)
- `get_monitor_mtta` — NO `required` key (NOKEY)
- `get_monitor_anomalies` — `uuid`
- `get_monitor_http_logs` — `uuid`
- `list_on_call_schedules` — NO `required` key (NOKEY)
- `get_on_call_schedule` — `uuid`
- `list_escalation_policies` — NO `required` key (NOKEY)
- `get_escalation_policy` — `uuid`
- `list_team_members` — NO `required` key (NOKEY)
- `get_on_call_now` — NO `required` key (NOKEY)
- `list_integrations` — NO `required` key (NOKEY)
- `get_integration` — `uuid`
- `list_status_pages` — NO `required` key (NOKEY)
- `get_status_page` — `uuid`
- `create_status_page` — `name`, `subdomain`
- `update_status_page` — `uuid`
- `add_status_page_services` — `uuid`, `services`
- `remove_status_page_services` — `uuid`, `services`
- `list_status_page_incidents` — NO `required` key (NOKEY)
- `get_status_page_incident` — `uuid`
- `create_status_page_incident` — `title`, `message`, `status_pages`
- `add_status_page_incident_update` — `uuid`, `message`, `status`
- `resolve_status_page_incident` — `uuid`, `message`
- `update_status_page_incident` — `uuid`
- `edit_status_page_incident_update` — `uuid`, `update_uuid`
- `list_maintenance_windows` — NO `required` key (NOKEY)
- `get_maintenance_window` — `uuid`
- `create_maintenance_window` — `name`, `start_date`, `end_date`, `monitors`
- `update_maintenance_window` — `uuid`
- `complete_maintenance_window` — `uuid`
- `cancel_maintenance_window` — `uuid`
- `search_logs` — NO `required` key (NOKEY)
- `get_outage_logs` — `uuid`
- `summarize_log_errors` — NO `required` key (NOKEY)
- `list_log_dashboards` — NO `required` key (NOKEY)
- `run_log_chart` — NO `required` key (NOKEY)
- `create_log_dashboard_from_template` — `template_id`
- `get_outage_checks` — `uuid`
- `find_correlated_outages` — NO `required` key (NOKEY)
- `get_recent_changes` — NO `required` key (NOKEY)
- `run_check_now` — `uuid`
- `list_healthchecks` — NO `required` key (NOKEY)
- `get_healthcheck` — `uuid`
- `list_servers` — NO `required` key (NOKEY)
- `get_server` — `uuid`
- `list_audit_log` — NO `required` key (NOKEY)
- `get_project_report` — NO `required` key (NOKEY)
- `get_outage_alerts` — `uuid`
- `list_browser_runs` — `uuid`
- `get_browser_run` — `uuid`

26 of the 69 tools carry NO `required` key in the capture; all
are served verbatim with none invented (asserted by dedicated
tests, including the exact bare-schema assertion for
`get_status_summary`).

## What was built

All 19 factory files under `builds/pingpulse/`:

- `package.json` (`@reneturcios/pingpulse` 0.1.0, bin
  `pingpulse` → `dist/cli.js`, deps exactly `@modelcontextprotocol/sdk ^1`
  + `zod ^3`; devDeps `@types/node ^20`, `tsx ^4`, `typescript ^5`)
- `server.json` (description exactly the prescribed 92-char string
  "Uptime monitoring: monitors, outages, on-call schedules, status pages, maintenance and logs.";
  npm entry carries `"version": "0.1.0"`; OCI entry
  `ghcr.io/cloudcorprecords/pingpulse:0.1.0` carries **no** version field)
- `Dockerfile` (node:20-alpine both stages; server-name label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/pingpulse"`
  matches `server.json`)
- `tsconfig.json` (fleet-identical, 318 bytes), `.gitignore`,
  `package-lock.json`, `README.md` (fresh prose), `LICENSE` (MIT,
  Copyright (c) 2026 Rene Turcios), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-28)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core; exports `VERSION = "0.1.0"`)
- `test/forward.test.ts`
- `.github/workflows/{ci.yml, publish.yml, publish-container.yml,
  registry-publish.yml}` (container workflow: IMAGE
  `ghcr.io/cloudcorprecords/pingpulse`, smoke assertion on server name
  `pingpulse`)

Plus `BUILD-REPORT.md` (this file) and the `parity-out/` harness output.

## Design

- Forwarding client to `https://api.hyperping.io/v1/mcp`
  (pinned), overridable via `HYPERPING_MCP_URL` (**labelled
  reconstruction**). tools/call is forwarded as a streamable-HTTP
  JSON-RPC client: initialize (protocolVersion `2025-03-26`,
  clientInfo `pingpulse`) → notifications/initialized → tools/call,
  honouring `Mcp-Session-Id` when issued; session established lazily
  and reused per client. Plain-JSON and SSE replies both parsed; the
  matching-id message wins; upstream results pass through verbatim
  (including `isError` and extra fields such as `structuredContent`).
- When `HYPERPING_API_KEY` is set, an `Authorization: Bearer <key>`
  header is sent on every upstream request (**labelled
  reconstructions**: the Bearer form, the env name, and the
  forwarding — the registry record pins the `Authorization` header
  name as a required secret for the remote, pins no package env
  name, and the capture was taken keyless). When unset, no key
  header is sent. No `X-API-Key` header is sent in either case.
  Both branches are covered by tests.
- Upstream failures (JSON-RPC error, non-2xx status, malformed body,
  throwing/timing-out fetch) surface as `pingpulse error:` text
  results (**labelled reconstruction**).
- Registration via the MCP SDK **low-level** `Server` API
  (`ListToolsRequestSchema` / `CallToolRequestSchema` handlers)
  serving the fixture literals exactly; no `McpServer` + zod
  registration. `src/mcp.ts` also exports `createServer` /
  `startMcpServer` / `handleCallTool` so the MCP layer is testable
  without a transport; the CLI's `mcp` subcommand starts it over stdio.
- Core takes an injectable fetch (`ForwardDeps.fetchFn`), so all tests
  run against a stubbed JSON-RPC upstream. No live network calls in
  tests; no live call claimed beyond the coordinator's tools/list
  capture. The built surface is the caller's own Hyperping monitoring
  workspace (monitors, outages, on-call, status pages, maintenance,
  logs, audit); no payment, billing or plan tool exists in the
  surface — none was added.

## Lockfile (Route 3, clean from birth)

Generated in the build dir with no `node_modules` present and no
pre-existing lockfile:
`npm install --package-lock-only --ignore-scripts --offline`.
Verified: parses, `name == @reneturcios/pingpulse`,
**128 package entries**. Then `npm install --offline --ignore-scripts`
in the build dir for `node_modules`.

## Verification (all in the build dir unless noted)

- `npx tsc --noEmit` → exit 0
- `npm run build` → real `dist/` (cli.js, forward.js, mcp.js, all
  non-empty, with `.d.ts` + source maps)
- `node dist/cli.js --version` → `0.1.0`; unknown subcommand → usage on
  stderr, exit 2
- `npm test` → **55 tests, 55 pass, 0 fail** (8 suites: registration
  integrity — served tools deep-equal the fixture's full 69 tool
  objects in order, names in fixture order, exactly the fixture's keys
  incl. title on every tool, required fields per tool for all 69 incl.
  the 26-NOKEY count/list assertion and the bare-schema assertion,
  every property key in order for all 69, list_monitors constraint
  literals, isKnownTool; session establishment/reuse/session-id
  handling, clientInfo/protocol version; env URL override, explicit
  url override, explicit-over-env precedence, blank-env fallback;
  Authorization Bearer header present on every request when the key
  is set / absent when unset / no X-API-Key header in either case;
  verbatim argument forwarding for list/get/create/empty-args calls;
  verbatim result pass-through incl. upstream isError and SSE;
  JSON-RPC/init/malformed/no-result/HTTP/throw/timeout failures →
  `pingpulse error:`; parseRpcBody JSON + SSE + matching-id + [DONE]
  cases; MCP-layer MethodNotFound / InvalidParams validation; CLI
  --version / -v / unknown exit 2 / bad-JSON exit 2 / `mcp extra`
  exit 2)
- Parity: `python3 harness/parity.py --original
  harness/fixtures/hyperping-tools-original.json --rebuild
  "stdio:node builds/pingpulse/dist/cli.js mcp" --out
  builds/pingpulse/parity-out` (run from `~/workspace/mcp-rebuild-100`)
  → **PASS, parity 100.0, 69/69 identical, no missing/extra/schema
  diffs** (see `parity-out/parity.json`)
- Consistency sweep: package.json version = server.json top-level =
  npm-entry version = OCI tag = core `VERSION` = CHANGELOG heading
  (0.1.0); package.json `mcpName` = server.json `name` = Dockerfile
  label; server.json description measured at 92 chars; OCI entry
  confirmed to have no `version` field.

Clean-room: all prose and code written fresh for pingpulse; only the
mechanics were patterned on the sibling carddata build, and only the
fixture's tool literals are served verbatim.
