#!/bin/sh
set -e

# Replace placeholders with environment variables
sed -i "s|YOUR_BACKEND_URL_HERE|${BACKEND_URL}|g" /usr/share/nginx/html/index.js
sed -i "s|YOUR_STATUS_PAGE_SLUG_HERE|${STATUS_PAGE_SLUG}|g" /usr/share/nginx/html/index.js

echo "Status page configured with:"
echo "  BACKEND_URL: ${BACKEND_URL}"
echo "  STATUS_PAGE_SLUG: ${STATUS_PAGE_SLUG}"

# Execute the CMD
exec "$@"