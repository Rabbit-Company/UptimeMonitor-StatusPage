# Configuration Guide

Complete reference for configuring UptimeMonitor-StatusPage.

## Quick Setup

Create or edit `config.js` in your deployment directory:

```javascript
globalThis.BACKEND_URL = "https://your-uptime-server.com";
globalThis.STATUS_PAGE_SLUG = "status";
globalThis.UPTIME_PRECISION = 3;
globalThis.LATENCY_PRECISION = 0;
globalThis.DEFAULT_PERIOD = "24h";
globalThis.DEFAULT_THEME = "midnight";
```

## Configuration Options

| Option              | Type   | Default      | Description                              |
| ------------------- | ------ | ------------ | ---------------------------------------- |
| `BACKEND_URL`       | string | **Required** | URL of your UptimeMonitor-Server         |
| `STATUS_PAGE_SLUG`  | string | **Required** | Slug from server's `status_pages` config |
| `UPTIME_PRECISION`  | number | `3`          | Decimal places for uptime percentages    |
| `LATENCY_PRECISION` | number | `0`          | Decimal places for latency values        |
| `DEFAULT_PERIOD`    | string | `"24h"`      | Default time period for uptime display   |
| `DEFAULT_THEME`     | string | `"midnight"` | Default color theme                      |

## Time Periods

Available values for `DEFAULT_PERIOD`:

| Period | Description   |
| ------ | ------------- |
| `1h`   | Last hour     |
| `24h`  | Last 24 hours |
| `7d`   | Last 7 days   |
| `30d`  | Last 30 days  |
| `90d`  | Last 90 days  |
| `365d` | Last 365 days |

## Example Configurations

### Production Setup

```javascript
globalThis.BACKEND_URL = "https://uptime-api.example.com";
globalThis.STATUS_PAGE_SLUG = "public";
globalThis.UPTIME_PRECISION = 2;
globalThis.LATENCY_PRECISION = 1;
globalThis.DEFAULT_PERIOD = "24h";
globalThis.DEFAULT_THEME = "tokyonight";
```

### Internal Dashboard

```javascript
globalThis.BACKEND_URL = "https://internal-monitoring.local";
globalThis.STATUS_PAGE_SLUG = "internal";
globalThis.UPTIME_PRECISION = 4;
globalThis.LATENCY_PRECISION = 2;
globalThis.DEFAULT_PERIOD = "7d";
globalThis.DEFAULT_THEME = "dracula";
```

### OLED-Optimized Display

```javascript
globalThis.BACKEND_URL = "https://status-api.example.com";
globalThis.STATUS_PAGE_SLUG = "status";
globalThis.UPTIME_PRECISION = 2;
globalThis.LATENCY_PRECISION = 0;
globalThis.DEFAULT_PERIOD = "24h";
globalThis.DEFAULT_THEME = "oled";
```

## Docker Environment Variables

When using Docker, all options can be set via environment variables:

```yaml
environment:
  - BACKEND_URL=https://your-server.com
  - STATUS_PAGE_SLUG=status
  - UPTIME_PRECISION=3
  - LATENCY_PRECISION=0
  - DEFAULT_PERIOD=24h
  - DEFAULT_THEME=midnight
```

## Finding Your Status Page Slug

The slug is defined in your [UptimeMonitor-Server](https://github.com/Rabbit-Company/UptimeMonitor-Server)'s `config.toml`:

```toml
[[status_pages]]
id = "public"
name = "Public Status Page"
slug = "status"           # <- Use this value
items = ["all-services"]
```

## Connecting to the Backend

The status page fetches data from these endpoints on your backend:

| Endpoint                              | Purpose                 |
| ------------------------------------- | ----------------------- |
| `GET /v1/status/:slug`                | Initial status data     |
| `GET /v1/monitors/:id/history`        | Raw pulse history       |
| `GET /v1/monitors/:id/history/hourly` | Hourly aggregated data  |
| `GET /v1/monitors/:id/history/daily`  | Daily aggregated data   |
| `GET /v1/groups/:id/history/*`        | Group history endpoints |
| `WebSocket /ws`                       | Real-time updates       |

## CORS Configuration

Ensure your backend allows requests from your status page domain. If using nginx as a reverse proxy:

```nginx
add_header Access-Control-Allow-Origin "https://status.example.com" always;
add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type" always;
```

## Troubleshooting

### "Failed to load status data"

- Verify `BACKEND_URL` is correct and accessible
- Check that `STATUS_PAGE_SLUG` matches your server config
- Ensure CORS is properly configured on the backend

### WebSocket Not Connecting

- Confirm WebSocket endpoint (`/ws`) is accessible
- Check that your proxy supports WebSocket upgrades
- Verify the backend server is running

### Theme Not Applying

- Clear browser cache and localStorage
- Verify `DEFAULT_THEME` is a valid theme name
- Check browser console for errors
