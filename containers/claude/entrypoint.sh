#!/bin/bash
set -e

echo "=== Autocoder - Claude Code Agent ==="

# Validate required environment variables
if [ -z "$CLAUDE_API_KEY" ]; then
    echo "Error: CLAUDE_API_KEY environment variable is required"
    exit 1
fi

# Export the API key for Claude CLI
export ANTHROPIC_API_KEY="$CLAUDE_API_KEY"

# Decode the prompt from base64 if provided
if [ -n "$AUTOCODER_PROMPT" ]; then
    PROMPT=$(echo "$AUTOCODER_PROMPT" | base64 -d)
    echo "Prompt received, executing Claude agent..."
else
    echo "No prompt provided, running in interactive mode..."
    PROMPT=""
fi

# Execute the Claude agent script
exec /scripts/run-claude.sh "$PROMPT"
