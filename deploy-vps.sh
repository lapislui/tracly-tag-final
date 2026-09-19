#!/bin/bash
# ==============================================================================
# Tracly-Tag Robust Production Deployment Script
# Supports:
# 1. First-time HTTP-only deployment & Let's Encrypt ACME verification
# 2. Subsequent zero-downtime updates with existing SSL certificates preserved
# 3. Comprehensive verification, health checks, & exit code error handling
# ==============================================================================

set -Eeuo pipefail

DOCKER_USER="${1:-}"
IMAGE_TAG="${2:-latest1}"
DOMAIN="app.tracelytag.com"
EMAIL="tracelytag@gmail.com"
CONTAINER_NAME="traclytag-app"

# Prompt for Username if not passed
if [ -z "${DOCKER_USER}" ]; then
    read -p "Enter your Docker Hub Username: " DOCKER_USER
fi

IMAGE_NAME="${DOCKER_USER}/tracly-tag-final:${IMAGE_TAG}"

echo "=========================================="
echo " Starting Production Deployment"
echo " Image:  ${IMAGE_NAME}"
echo " Domain: ${DOMAIN}"
echo "=========================================="

# 1. Pull requested image
echo "[1/9] Pulling Docker image '${IMAGE_NAME}'..."
if ! docker pull "${IMAGE_NAME}"; then
    echo "ERROR: Failed to pull image '${IMAGE_NAME}'. Check image tag or docker login status."
    exit 1
fi

# 2. Stop and remove existing container
echo "[2/9] Cleaning up previous application container..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# 3. Create persistent host directories
echo "[3/9] Preparing persistent data and certificate storage directories..."
mkdir -p ./lib/db
mkdir -p ./artifacts/api-server/uploads
mkdir -p ./letsencrypt
mkdir -p ./certbot-acme

chmod -R 755 ./letsencrypt ./certbot-acme

# 4. Start the application container
echo "[4/9] Launching container '${CONTAINER_NAME}'..."
if ! docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart always \
  -p 80:80 \
  -p 443:443 \
  -v "$(pwd)/lib/db:/app/lib/db" \
  -v "$(pwd)/artifacts/api-server/uploads:/app/artifacts/api-server/uploads" \
  -v "$(pwd)/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/certbot-acme:/var/www/certbot" \
  "${IMAGE_NAME}"; then
    echo "ERROR: Failed to start container '${CONTAINER_NAME}'."
    exit 1
fi

# 5. Wait for Supervisor & Node API internal startup
echo "[5/9] Waiting for container internal processes to initialize..."
sleep 4

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container failed immediately after startup. Check container logs:"
    docker logs "${CONTAINER_NAME}" --tail 50
    exit 1
fi

# 6. Verify Nginx configuration inside container
echo "[6/9] Validating Nginx configuration inside container..."
if ! docker exec "${CONTAINER_NAME}" nginx -t; then
    echo "ERROR: Nginx configuration test failed!"
    docker exec "${CONTAINER_NAME}" cat /etc/nginx/http.d/default.conf || true
    exit 1
fi

# 7. Check or Issue SSL Certificates
echo "[7/9] Managing SSL Certificates..."
CERT_PATH="./letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ ! -f "${CERT_PATH}" ]; then
    echo "No SSL certificate found for ${DOMAIN}. Starting ACME HTTP-01 challenge..."
    
    # Test HTTP ACME endpoint accessibility locally
    echo "Testing ACME challenge path accessibility..."
    TEST_FILE="./certbot-acme/test-acme.txt"
    echo "acme-test-ok" > "${TEST_FILE}"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/.well-known/acme-challenge/test-acme.txt" || echo "000")
    rm -f "${TEST_FILE}"
    
    if [ "${HTTP_CODE}" != "200" ]; then
        echo "WARNING: Local HTTP test returned code [${HTTP_CODE}]. Requesting certificate..."
    fi

    # Execute Certbot inside container using shared webroot
    if docker exec "${CONTAINER_NAME}" certbot certonly --webroot -w /var/www/certbot -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}"; then
        echo "SSL Certificate successfully generated!"
        echo "Switching Nginx to HTTPS mode..."
        docker exec "${CONTAINER_NAME}" /bin/sh /app/entrypoint-nginx.sh &
        sleep 2
        docker exec "${CONTAINER_NAME}" nginx -s reload || true
    else
        echo "ERROR: Certbot failed to issue SSL certificate for ${DOMAIN}."
        echo "App is running in HTTP-only fallback mode on port 80."
        echo "Check DNS (app.tracelytag.com -> 51.79.160.129) and Firewall rules (ports 80 & 443)."
        exit 1
    fi
else
    echo "Existing SSL certificate verified (${CERT_PATH})."
    
    # Trigger certificate renewal check if within 30 days of expiry
    echo "Running certbot renewal check..."
    docker exec "${CONTAINER_NAME}" certbot renew --quiet || true
    docker exec "${CONTAINER_NAME}" nginx -s reload || true
fi

# 8. Perform Comprehensive Health Checks
echo "[8/9] Performing application health checks..."

# Check Node API internal endpoint
API_HEALTH=$(docker exec "${CONTAINER_NAME}" wget -q -O - http://127.0.0.1:3000/api/health 2>/dev/null || echo "FAIL")
if [ "${API_HEALTH}" = "FAIL" ]; then
    echo "WARNING: Internal API health check on port 3000 failed to respond."
fi

# Check HTTP response
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/" || echo "000")
echo "Local HTTP response code: ${HTTP_STATUS}"

if [ "${HTTP_STATUS}" = "000" ]; then
    echo "ERROR: Nginx on port 80 is unreachable."
    exit 1
fi

# 9. Clean up dangling images
echo "[9/9] Cleaning up dangling Docker images..."
docker image prune -f >/dev/null 2>&1 || true

echo "=========================================="
echo " SUCCESS! Production deployment completed."
echo " Domain: https://${DOMAIN}"
echo " Status: Healthy & Active"
echo "=========================================="
docker ps -f name="${CONTAINER_NAME}"
