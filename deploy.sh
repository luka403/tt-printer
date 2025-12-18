#!/bin/bash
# 🚀 Deploy Script for Python LLM API Server
# Usage: ./deploy.sh user@server-ip

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server address is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Server address required${NC}"
    echo "Usage: ./deploy.sh user@server-ip"
    echo "Example: ./deploy.sh newuser@167.235.22.26"
    exit 1
fi

SERVER=$1
SERVER_USER=$(echo $SERVER | cut -d'@' -f1)
SERVER_HOST=$(echo $SERVER | cut -d'@' -f2)
REMOTE_DIR="/tmp/llm-api"
REMOTE_USER_HOME="/home/$SERVER_USER"

# If root, use /root
if [ "$SERVER_USER" = "root" ]; then
    REMOTE_USER_HOME="/root"
fi

echo -e "${GREEN}🚀 Starting deployment to $SERVER${NC}"
echo ""

# Step 1: Check if .env exists locally
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    if [ -f "server/env.example" ]; then
        cp server/env.example server/.env
        echo -e "${YELLOW}⚠️  Please edit server/.env and change API_KEY before deploying!${NC}"
        read -p "Press Enter to continue or Ctrl+C to cancel..."
    else
        echo -e "${RED}❌ env.example not found!${NC}"
        exit 1
    fi
fi

# Step 2: Create remote directory
echo -e "${GREEN}📁 Creating remote directory...${NC}"
ssh $SERVER "mkdir -p $REMOTE_DIR"

# Step 3: Copy files to server
echo -e "${GREEN}📤 Copying files to server...${NC}"
scp server/llm_api.py $SERVER:$REMOTE_DIR/
scp server/requirements.txt $SERVER:$REMOTE_DIR/
scp server/.env $SERVER:$REMOTE_DIR/ 2>/dev/null || {
    echo -e "${YELLOW}⚠️  .env not found, copying env.example instead${NC}"
    scp server/env.example $SERVER:$REMOTE_DIR/.env
}

# Copy start script if exists
if [ -f "server/start.sh" ]; then
    scp server/start.sh $SERVER:$REMOTE_DIR/
    ssh $SERVER "chmod +x $REMOTE_DIR/start.sh"
fi

# Step 4: Install Python dependencies on server
echo -e "${GREEN}📦 Installing Python dependencies...${NC}"
ssh $SERVER "cd $REMOTE_DIR && python3 -m pip install --user -r requirements.txt || pip3 install --user -r requirements.txt"

# Step 5: Check if Ollama is running
echo -e "${GREEN}🔍 Checking Ollama...${NC}"
OLLAMA_RUNNING=$(ssh $SERVER "curl -s http://localhost:11434/api/tags > /dev/null 2>&1 && echo 'yes' || echo 'no'")
if [ "$OLLAMA_RUNNING" = "no" ]; then
    echo -e "${YELLOW}⚠️  Ollama doesn't seem to be running on the server${NC}"
    echo -e "${YELLOW}   Make sure Ollama is installed and running:${NC}"
    echo -e "${YELLOW}   curl -fsSL https://ollama.com/install.sh | sh${NC}"
    echo -e "${YELLOW}   ollama pull llama3.1:8b${NC}"
    echo -e "${YELLOW}   ollama serve${NC}"
else
    echo -e "${GREEN}✅ Ollama is running${NC}"
fi

# Step 6: Get API key for display
API_KEY=$(ssh $SERVER "grep API_KEY $REMOTE_DIR/.env 2>/dev/null | cut -d'=' -f2 | tr -d '\"' | tr -d \"'\" | head -1" || echo "not-found")

# Step 7: Display next steps
echo ""
echo -e "${GREEN}✅ Files copied to $REMOTE_DIR${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps (run on server):${NC}"
echo ""
echo "1. SSH to server:"
echo "   ssh $SERVER"
echo ""
echo "2. Copy files to final location (with sudo if needed):"
echo "   sudo mkdir -p /opt/llm-api"
echo "   sudo cp -r $REMOTE_DIR/* /opt/llm-api/"
echo "   sudo chown -R $SERVER_USER:$SERVER_USER /opt/llm-api"
echo ""
echo "3. Install dependencies (if not already done):"
echo "   cd /opt/llm-api"
echo "   pip3 install --user -r requirements.txt"
echo ""
echo "4. Test run:"
echo "   cd /opt/llm-api"
echo "   python3 llm_api.py"
echo ""
echo "5. Or create systemd service (optional):"
echo "   sudo nano /etc/systemd/system/llm-api.service"
echo ""
echo "   Add this content:"
echo "   [Unit]"
echo "   Description=Ollama LLM API Server"
echo "   After=network.target"
echo ""
echo "   [Service]"
echo "   Type=simple"
echo "   User=$SERVER_USER"
echo "   WorkingDirectory=/opt/llm-api"
echo "   Environment=\"PATH=/usr/bin:/usr/local/bin:/home/$SERVER_USER/.local/bin\""
echo "   ExecStart=/usr/bin/python3 /opt/llm-api/llm_api.py"
echo "   Restart=always"
echo "   RestartSec=10"
echo ""
echo "   [Install]"
echo "   WantedBy=multi-user.target"
echo ""
echo "   Then:"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable llm-api"
echo "   sudo systemctl start llm-api"
echo ""
echo -e "${GREEN}🔑 API Key from .env: $API_KEY${NC}"
echo ""
echo -e "${GREEN}✅ Files ready in $REMOTE_DIR${NC}"
echo -e "${YELLOW}   Copy them manually to final location when ready!${NC}"

