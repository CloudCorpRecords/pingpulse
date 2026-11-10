# pingpulse

pingpulse is a small local bridge to the hosted
Hyperping uptime-monitoring MCP server. It puts the
whole monitoring workspace behind one tool surface:
the monitors watching your sites and APIs, the outages
they produce, the people who get woken up when
something breaks, and the public status pages that
tell your users what is happening.

From here an agent can list and inspect monitors,
pause or resume them, run a check on demand, read
uptime, response-time, MTTR and MTTA figures, work
through outages (acknowledge, escalate, resolve),
review on-call schedules and escalation policies,
manage status pages and post or update their
incidents, schedule maintenance windows, search logs
and log dashboards, and pull project reports,
healthchecks, servers, browser runs and the audit
log. The surface is 69 tools, exactly as captured
from the live endpoint. No payment, billing or plan
tool exists in it.

The bridge holds no monitoring data of its own. It
answers the tool list locally, exactly as captured,
and forwards each tool call upstream, returning
whatever comes back untouched.

## Tools

Grouped by area; required arguments are listed where
the captured schema carries them. Tools not listed
with required arguments take none that are required
(26 of the 69 carry no `required` key at all in the
capture, and they are served that way).

- Monitors: `list_monitors`, `get_monitor` (`uuid`),
  `create_monitor` (`name`, `url`), `update_monitor`
  (`uuid`), `pause_monitor` (`uuid`), `resume_monitor`
  (`uuid`), `search_monitors_by_name` (`query`),
  `get_status_summary`.
- Outages and alerts: `list_outages`, `get_outage`
  (`uuid`), `get_outage_timeline` (`uuid`),
  `get_monitor_outages` (`monitor_uuid`),
  `create_outage` (`description`),
  `acknowledge_outage` (`uuid`), `escalate_outage`
  (`uuid`), `resolve_outage` (`uuid`),
  `list_recent_alerts`, `get_outage_alerts` (`uuid`).
- Monitor metrics: `get_monitor_uptime`,
  `get_monitor_response_time`, `get_monitor_mttr`,
  `get_monitor_mtta`, `get_monitor_anomalies` (`uuid`),
  `get_monitor_http_logs` (`uuid`).
- On-call: `list_on_call_schedules`,
  `get_on_call_schedule` (`uuid`),
  `list_escalation_policies`, `get_escalation_policy`
  (`uuid`), `list_team_members`, `get_on_call_now`.
- Integrations: `list_integrations`, `get_integration`
  (`uuid`).
- Status pages: `list_status_pages`,
  `get_status_page` (`uuid`), `create_status_page`
  (`name`, `subdomain`), `update_status_page` (`uuid`),
  `add_status_page_services` (`uuid`, `services`),
  `remove_status_page_services` (`uuid`, `services`).
- Status page incidents: `list_status_page_incidents`,
  `get_status_page_incident` (`uuid`),
  `create_status_page_incident` (`title`, `message`,
  `status_pages`), `add_status_page_incident_update`
  (`uuid`, `message`, `status`),
  `resolve_status_page_incident` (`uuid`, `message`),
  `update_status_page_incident` (`uuid`),
  `edit_status_page_incident_update` (`uuid`,
  `update_uuid`).
- Maintenance: `list_maintenance_windows`,
  `get_maintenance_window` (`uuid`),
  `create_maintenance_window` (`name`, `start_date`,
  `end_date`, `monitors`), `update_maintenance_window`
  (`uuid`), `complete_maintenance_window` (`uuid`),
  `cancel_maintenance_window` (`uuid`).
- Logs: `search_logs`, `get_outage_logs` (`uuid`),
  `summarize_log_errors`, `list_log_dashboards`,
  `run_log_chart`, `create_log_dashboard_from_template`
  (`template_id`).
- Checks and changes: `get_outage_checks` (`uuid`),
  `find_correlated_outages`, `get_recent_changes`,
  `run_check_now` (`uuid`).
- Platform views: `list_healthchecks`,
  `get_healthcheck` (`uuid`), `list_servers`,
  `get_server` (`uuid`), `list_audit_log`,
  `get_project_report`, `list_browser_runs` (`uuid`),
  `get_browser_run` (`uuid`).

## Configuration

- `HYPERPING_MCP_URL` (optional) — override the
  upstream endpoint. Defaults to
  `https://api.hyperping.io/v1/mcp`. (The override
  hook is this rebuild's own labelled reconstruction.)
- `HYPERPING_API_KEY` (optional) — when set, every
  upstream request carries an
  `Authorization: Bearer <key>` header with your
  Hyperping API key. When it is not set, no key header
  is sent; the captured surface answered its tool list
  without a key. (The `Authorization` header name is
  pinned by the original's registry record, which
  declares it a required secret for the remote; the
  record pins no package env name, so the Bearer form
  and forwarding the key from this env var are
  labelled reconstructions.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session upstream: a JSON-RPC `initialize`
request (protocolVersion `2025-03-26`, clientInfo
name `pingpulse`), then a
`notifications/initialized` notification, then the
`tools/call` request carrying the caller's arguments
unchanged. When the upstream answers `initialize`
with an `Mcp-Session-Id` header, that value rides on
every later request of the session, which is reused
for the life of the process. Replies may arrive as
plain JSON or as server-sent events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `pingpulse error:` (this rendering
is this rebuild's own labelled reconstruction).

## CLI

Each tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/pingpulse list_monitors '{"status":"down"}'
npx @reneturcios/pingpulse get_monitor '{"uuid":"mon_..."}'
npx @reneturcios/pingpulse create_monitor '{"name":"API","url":"https://example.com/health"}'
npx @reneturcios/pingpulse get_status_summary '{}'
npx @reneturcios/pingpulse --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/pingpulse mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "pingpulse": {
      "command": "npx",
      "args": ["-y", "@reneturcios/pingpulse", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/pingpulse
docker run --rm ghcr.io/cloudcorprecords/pingpulse --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.
