#!/bin/bash
set -e

echo "=== Autocoder - GitHub Copilot Agent ==="

# Validate required environment variables
if [ -z "$GITHUB_PAT" ]; then
    echo "Error: GITHUB_PAT environment variable is required"
    exit 1
fi

# Authenticate with GitHub
echo "Authenticating with GitHub..."
echo "$GITHUB_PAT" | gh auth login --with-token

# Decode the prompt from base64 if provided
if [ -n "$AUTOCODER_PROMPT" ]; then
    PROMPT=$(echo "$AUTOCODER_PROMPT" | base64 -d)
    echo "Prompt received, executing Copilot agent..."
else
    echo "No prompt provided, running in interactive mode..."
    PROMPT=""
fi

# Execute the Copilot agent script
exec /scripts/run-copilot.sh "$PROMPT"
