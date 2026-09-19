#!/bin/sh
# Nginx Entrypoint / Wrapper script
# Dynamically enables HTTPS server block if SSL certificate files are present

DOMAIN="app.tracelytag.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

CONF_DIR="/etc/nginx/http.d"
ACTIVE_CONF="${CONF_DIR}/default.conf"
HTTP_ONLY_CONF="/etc/nginx/http-only.conf"
HTTPS_CONF="/etc/nginx/nginx-ssl.conf"

mkdir -p /var/www/certbot /run/nginx /etc/letsencrypt

# Separate the dual server config into HTTP-only and HTTPS blocks
cat << 'EOF' > ${HTTP_ONLY_CONF}
server {
    listen 80 default_server;
    server_name app.tracelytag.com _;

    client_max_body_size 50M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    location / {
        root /app/artifacts/traclytag/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

cat << 'EOF' > ${HTTPS_CONF}
server {
    listen 80 default_server;
    server_name app.tracelytag.com _;

    client_max_body_size 50M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }

    location /api {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name app.tracelytag.com;

    client_max_body_size 50M;

    ssl_certificate /etc/letsencrypt/live/app.tracelytag.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.tracelytag.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    location / {
        root /app/artifacts/traclytag/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
    echo "[nginx-entrypoint] SSL certificate found. Loading HTTPS configuration."
    cp ${HTTPS_CONF} ${ACTIVE_CONF}
else
    echo "[nginx-entrypoint] SSL certificate NOT found. Loading HTTP-only bootstrap configuration."
    cp ${HTTP_ONLY_CONF} ${ACTIVE_CONF}
fi

exec nginx -g "daemon off;"
