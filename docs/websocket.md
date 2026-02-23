# WebSocket Connection Guide

The status page maintains a WebSocket connection for real-time updates without page refreshes.

## Connection Behavior

### Auto-Connect

The WebSocket connection is established automatically when the page loads.

### Reconnection

If the connection drops, the status page automatically reconnects:

- **Base delay**: 1 second
- **Max delay**: 30 seconds
- **Max attempts**: 10000
- **Strategy**: Exponential backoff with jitter

### Connection Indicator

The header displays connection status:

| Status           | Indicator           | Meaning                           |
| ---------------- | ------------------- | --------------------------------- |
| **Live**         | 🟢 Green            | Connected and receiving updates   |
| **Reconnecting** | 🟡 Yellow (pulsing) | Connection lost, retrying         |
| **Disconnected** | 🔴 Red              | Not connected                     |
| **Failed**       | 🔴 Red              | Max reconnection attempts reached |

## WebSocket Protocol

### Connection URL

Derived from `BACKEND_URL`:

```
https://api.example.com → wss://api.example.com/ws
http://localhost:3000  → ws://localhost:3000/ws
```

### Subscribe to Status Page

After connecting, the client subscribes to a specific status page:

```json
{
	"action": "subscribe",
	"slug": "status"
}
```

### Server Response

```json
{
	"action": "subscribed",
	"slug": "status",
	"message": "Subscription successful",
	"timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Real-Time Events

### Pulse Update

Sent when a monitor receives a pulse:

```json
{
	"action": "pulse",
	"data": {
		"slug": "status",
		"monitorId": "api-prod",
		"status": "up",
		"latency": 125,
		"timestamp": "2025-01-15T10:30:00.000Z",
		"custom1": 42,
		"custom2": 19.8
	},
	"timestamp": "2025-01-15T10:30:00.000Z"
}
```

**UI Updates**:

- Monitor status indicator updates
- Latency value refreshes
- Custom metrics update (if present)
- "Last updated" timestamp changes
- Brief highlight animation on the monitor row

### Monitor Down

Sent when a monitor is marked as down:

```json
{
	"action": "monitor-down",
	"data": {
		"slug": "status",
		"monitorId": "api-prod",
		"downtime": 60000
	},
	"timestamp": "2025-01-15T10:30:00.000Z"
}
```

**UI Updates**:

- Monitor status changes to red
- Overall status may change to "Degraded" or "Down"
- Toast notification appears: "Production API is down"
- Services down counter increments

### Monitor Still Down

Sent when a monitor remains down after consecutive checks:

```json
{
	"action": "monitor-still-down",
	"data": {
		"slug": "status",
		"monitorId": "api-prod",
		"consecutiveDownCount": 5,
		"downtime": 300000
	},
	"timestamp": "2025-01-15T10:35:00.000Z"
}
```

### Monitor Recovered

Sent when a down monitor comes back up:

```json
{
	"action": "monitor-recovered",
	"data": {
		"slug": "status",
		"monitorId": "api-prod",
		"previousConsecutiveDownCount": 5,
		"downtime": 300000
	},
	"timestamp": "2025-01-15T10:35:00.000Z"
}
```

**UI Updates**:

- Monitor status changes to green
- Overall status recalculates
- Toast notification appears: "Production API has recovered"
- Services up/down counters update

### Incident Created

Sent when a new incident is opened on the status page:

```json
{
	"action": "incident-created",
	"data": {
		"slug": "status",
		"incident": {
			"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"status_page_id": "main",
			"title": "Database connectivity issues",
			"status": "investigating",
			"severity": "major",
			"affected_monitors": ["api-prod"],
			"created_at": "2026-02-15T10:30:00.000Z",
			"updated_at": "2026-02-15T10:30:00.000Z",
			"resolved_at": null,
			"updates": [
				{
					"id": "f6e5d4c3-b2a1-0987-fedc-ba9876543210",
					"incident_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
					"status": "investigating",
					"message": "We are investigating reports of degraded database performance.",
					"created_at": "2026-02-15T10:30:00.000Z"
				}
			]
		}
	},
	"timestamp": "2026-02-15T10:30:00.000Z"
}
```

**UI Updates**:

- New incident appears in the incidents section
- Toast notification for new incident

### Incident Updated

Sent when incident metadata changes (title, severity, or affected monitors):

```json
{
	"action": "incident-updated",
	"data": {
		"slug": "status",
		"incident": {
			"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"status_page_id": "main",
			"title": "Database connectivity issues - update",
			"status": "investigating",
			"severity": "critical",
			"affected_monitors": ["api-prod", "web-app"],
			"created_at": "2026-02-15T10:30:00.000Z",
			"updated_at": "2026-02-15T10:35:00.000Z",
			"resolved_at": null,
			"updates": []
		}
	},
	"timestamp": "2026-02-15T10:35:00.000Z"
}
```

**UI Updates**:

- Incident title, severity badge, and affected monitors refresh

### Incident Update Added

Sent when a new timeline update is posted to an incident (progressing its status):

```json
{
	"action": "incident-update-added",
	"data": {
		"slug": "status",
		"incident": {
			"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"status_page_id": "main",
			"title": "Database connectivity issues",
			"status": "identified",
			"severity": "major",
			"affected_monitors": ["api-prod"],
			"created_at": "2026-02-15T10:30:00.000Z",
			"updated_at": "2026-02-15T10:45:00.000Z",
			"resolved_at": null,
			"updates": []
		},
		"update": {
			"id": "11223344-5566-7788-99aa-bbccddeeff00",
			"incident_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"status": "identified",
			"message": "We have identified the root cause as a failed database migration.",
			"created_at": "2026-02-15T10:45:00.000Z"
		}
	},
	"timestamp": "2026-02-15T10:45:00.000Z"
}
```

**UI Updates**:

- New timeline entry appears on the incident
- Incident status badge updates
- Toast notification for status change
- If status is `resolved`, the incident's `resolved_at` timestamp is set

### Incident Update Deleted

Sent when a timeline update is removed from an incident:

```json
{
	"action": "incident-update-deleted",
	"data": {
		"slug": "status",
		"incidentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"updateId": "11223344-5566-7788-99aa-bbccddeeff00",
		"incident": {
			"id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"status_page_id": "main",
			"title": "Database connectivity issues",
			"status": "investigating",
			"severity": "major",
			"affected_monitors": ["api-prod"],
			"created_at": "2026-02-15T10:30:00.000Z",
			"updated_at": "2026-02-15T10:50:00.000Z",
			"resolved_at": null,
			"updates": []
		}
	},
	"timestamp": "2026-02-15T10:50:00.000Z"
}
```

**UI Updates**:

- Timeline entry removed from the incident
- Incident status may revert if the deleted update was the most recent

### Incident Deleted

Sent when an incident is fully removed:

```json
{
	"action": "incident-deleted",
	"data": {
		"slug": "status",
		"incidentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	},
	"timestamp": "2026-02-15T11:00:00.000Z"
}
```

**UI Updates**:

- Incident removed from the incidents section

## Notifications

Status changes trigger toast notifications in the bottom-right corner:

| Event             | Type            | Example Message                                   |
| ----------------- | --------------- | ------------------------------------------------- |
| Monitor down      | Error (red)     | "Production API is down"                          |
| Monitor recovered | Success (green) | "Production API has recovered"                    |
| Incident created  | Warning (amber) | "New incident: Database connectivity issues"      |
| Incident resolved | Success (green) | "Incident resolved: Database connectivity issues" |

Notifications auto-dismiss after 5 seconds.

## Handling Disconnection

When the WebSocket disconnects:

1. Connection indicator turns yellow/red
2. Page continues displaying last known data
3. Automatic reconnection attempts begin
4. On reconnect, full status is refetched via REST API

## Manual Refresh

Users can always manually refresh the page to get the latest data. The page fetches fresh status data from the REST API on every page load.

## Debugging WebSocket

Open browser DevTools → Network → WS tab to see:

- Connection status
- Messages sent/received
- Connection close codes

Console logs include:

```
[WS] Connecting to wss://api.example.com/ws...
[WS] Connection established
[WS] Server acknowledged connection
[WS] Subscribed to status page: status
```

## Proxy Configuration

### Nginx WebSocket Proxy

```nginx
location /ws {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400;
}
```

### Cloudflare

Enable WebSocket support in your Cloudflare dashboard:

1. Go to Network settings
2. Enable "WebSockets"

### AWS ALB

WebSocket is supported by default on Application Load Balancers. Ensure:

- Idle timeout is sufficient (default 60s)
- Target group uses HTTP/1.1

## Troubleshooting

### "WebSocket connection failed"

- Verify backend is running and accessible
- Check that WebSocket endpoint `/ws` exists
- Ensure proxy supports WebSocket upgrades

### Frequent Disconnections

- Check idle timeout settings on proxies/load balancers
- The backend sends ping messages; ensure they're not blocked
- Verify network stability

### No Real-Time Updates

- Check WebSocket is connected (green indicator)
- Verify you're subscribed to the correct slug
- Check browser console for errors

### Updates Stop After a While

- Connection may have silently dropped
- Check proxy idle timeout settings
- Consider implementing client-side ping/pong
