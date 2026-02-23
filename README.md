# UptimeMonitor-StatusPage

A real-time status page frontend for [UptimeMonitor-Server](https://github.com/Rabbit-Company/UptimeMonitor-Server). Built with TypeScript and Tailwind CSS.

![Status Page](./screenshots/status-page.png)

## Features

| Feature                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| **Real-Time Updates**   | WebSocket connection for instant status changes  |
| **Interactive Charts**  | Zoom and pan through uptime/latency history      |
| **15 Themes**           | Midnight, OLED, Tokyo Night, Dracula, and more   |
| **Custom Metrics**      | Display up to 3 custom metrics per monitor       |
| **Incident Tracking**   | View active and past incidents with timelines    |
| **Responsive Design**   | Optimized for desktop, tablet, and mobile        |
| **Toast Notifications** | Live alerts for status changes                   |
| **Group Support**       | Hierarchical organization with expandable groups |

## Quick Start

### Docker Compose

```yaml
services:
  status-page:
    image: rabbitcompany/status-page:latest
    container_name: status-page
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      # Change to your own backend server and slug
      - BACKEND_URL=https://pulse.rabbit-company.com
      - STATUS_PAGE_SLUG=passky
      - UPTIME_PRECISION=3
      - LATENCY_PRECISION=0
      - DEFAULT_PERIOD=24h
      - DEFAULT_THEME=midnight
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
sudo docker compose up -d
```

### Static Hosting

#### Download prebuild version

1. Prebuild version can be downloaded [HERE](https://github.com/Rabbit-Company/UptimeMonitor-StatusPage/releases/latest/download/dist.zip).
2. Deploy the `dist/` directory
3. Configure `config.js` (see [Configuration](docs/configuration.md))

#### Build yourself

1. Build: `bun install && bun run build`
2. Deploy the `dist/` directory
3. Configure `config.js` (see [Configuration](docs/configuration.md))

## Configuration

Edit `config.js` in your deployment:

```javascript
globalThis.BACKEND_URL = "https://your-uptime-server.com";
globalThis.STATUS_PAGE_SLUG = "status";
globalThis.DEFAULT_THEME = "midnight";
```

See [Configuration Guide](docs/configuration.md) for all options.

## Documentation

| Guide                                  | Description                        |
| -------------------------------------- | ---------------------------------- |
| [Configuration](docs/configuration.md) | All configuration options          |
| [Themes](docs/themes.md)               | Available themes and customization |
| [Deployment](docs/deployment.md)       | Docker, Nginx, and static hosting  |
| [WebSocket](docs/websocket.md)         | Real-time connection details       |

## Screenshots

<details>
<summary>Monitor History Modal</summary>

![Monitor History](./screenshots/monitor-history.png)

</details>

## Related Projects

| Project                                                                        | Description                    |
| ------------------------------------------------------------------------------ | ------------------------------ |
| [UptimeMonitor-Server](https://github.com/Rabbit-Company/UptimeMonitor-Server) | Backend monitoring server      |
| [PulseMonitor](https://github.com/Rabbit-Company/PulseMonitor)                 | Automated pulse sending client |

## 📄 License

[GPL-3.0](LICENSE)
