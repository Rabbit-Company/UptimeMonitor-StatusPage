#!/bin/sh
set -e

# Replace placeholders with environment variables
sed -i "s|YOUR_BACKEND_URL_HERE|${BACKEND_URL}|g" /usr/share/nginx/html/config.js
sed -i "s|YOUR_STATUS_PAGE_SLUG_HERE|${STATUS_PAGE_SLUG}|g" /usr/share/nginx/html/config.js
sed -i "s|YOUR_UPTIME_PRECISION_HERE|${UPTIME_PRECISION}|g" /usr/share/nginx/html/config.js
sed -i "s|YOUR_LATENCY_PRECISION_HERE|${LATENCY_PRECISION}|g" /usr/share/nginx/html/config.js
sed -i "s|YOUR_DEFAULT_PERIOD_HERE|${DEFAULT_PERIOD}|g" /usr/share/nginx/html/config.js

echo "Status page configured with:"
echo "  BACKEND_URL: ${BACKEND_URL}"
echo "  STATUS_PAGE_SLUG: ${STATUS_PAGE_SLUG}"
echo "	UPTIME_PRECISION: ${UPTIME_PRECISION}"
echo "	LATENCY_PRECISION: ${LATENCY_PRECISION}"
echo "	DEFAULT_PERIOD: ${DEFAULT_PERIOD}"

# Execute the CMD
exec "$@"