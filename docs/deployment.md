# Deployment Guide

Deploy UptimeMonitor-StatusPage using Docker, static hosting, or a web server.

## Docker Compose

### Basic Setup

```yaml
services:
  status-page:
    image: rabbitcompany/status-page:latest
    container_name: status-page
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - BACKEND_URL=https://your-uptime-server.com
      - STATUS_PAGE_SLUG=status
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

## Static Hosting

### Download static files

Prebuild version can be downloaded [HERE](https://github.com/Rabbit-Company/UptimeMonitor-StatusPage/releases/latest/download/dist.zip). Do not forget to change configuration inside `config.js` file.

### Build Process

```bash
# Install dependencies
bun install

# Build for production
bun run build

# Output is in dist/
# Do not forget to change configuration inside `config.js` file.
```

## Nginx Configuration

### Basic Setup

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    server {
        listen 80;
        server_name status.example.com;

        root /var/www/status-page;
        index index.html;

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1h;
            add_header Cache-Control "public, immutable";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### With Security Headers

```nginx
server {
    listen 80;
    server_name status.example.com;

    root /var/www/status-page;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "document-domain=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http: https: ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
```

### With SSL (Certbot)

```nginx
server {
    listen 80;
    server_name status.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name status.example.com;

    ssl_certificate /etc/letsencrypt/live/status.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/status.example.com/privkey.pem;

    root /var/www/status-page;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Security Headers Reference

The included `_headers` file provides security headers for platforms like Cloudflare Pages and Netlify:

## Troubleshooting

### Blank Page After Deployment

- Check browser console for JavaScript errors
- Verify `config.js` is being loaded (network tab)
- Ensure `BACKEND_URL` is correct and accessible

### CORS Errors

- Configure your backend to allow the status page origin
- Check that WebSocket connections are allowed

### Assets Not Loading

- Verify all files are in the deployment directory
- Check that MIME types are configured correctly in your server
- Ensure `index.css` and `index.js` paths are correct

### WebSocket Connection Failed

- Ensure your reverse proxy supports WebSocket upgrades
- For nginx: add `proxy_set_header Upgrade $http_upgrade;`
- Check firewall rules for WebSocket ports
