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

## Notifications

Status changes trigger toast notifications in the bottom-right corner:

| Event             | Type            | Example Message                |
| ----------------- | --------------- | ------------------------------ |
| Monitor down      | Error (red)     | "Production API is down"       |
| Monitor recovered | Success (green) | "Production API has recovered" |

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
