#!/bin/bash
# Skripta za kopiranje image API fajlova na server u /tmp

SERVER_USER="${1:-root}"
SERVER_HOST="${2:-your-server.com}"
REMOTE_TMP="/tmp/tt-printer-image-api"

echo "📦 Kopiranje fajlova na server ${SERVER_USER}@${SERVER_HOST}..."

# Kreiraj remote tmp direktorijum
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_TMP}"

# Kopiraj fajlove
echo "📄 Kopiranje image_api.py..."
scp server/image_api.py ${SERVER_USER}@${SERVER_HOST}:${REMOTE_TMP}/

echo "📄 Kopiranje requirements.txt..."
scp server/requirements.txt ${SERVER_USER}@${SERVER_HOST}:${REMOTE_TMP}/

echo "📄 Kopiranje start_image_api.sh..."
scp server/start_image_api.sh ${SERVER_USER}@${SERVER_HOST}:${REMOTE_TMP}/

echo "📄 Kopiranje env.example..."
scp server/env.example ${SERVER_USER}@${SERVER_HOST}:${REMOTE_TMP}/

echo "✅ Fajlovi su kopirani u ${REMOTE_TMP} na serveru"
echo ""
echo "Sledeći koraci:"
echo "1. SSH na server: ssh ${SERVER_USER}@${SERVER_HOST}"
echo "2. cd ${REMOTE_TMP}"
echo "3. Prati uputstva u SETUP_LOCAL_MODEL.md"









