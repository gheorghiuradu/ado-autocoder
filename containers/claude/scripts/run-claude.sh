#!/bin/bash
set -e

PROMPT="$1"

echo "=== Running Claude Code Agent ==="

# Ensure we're in the workspace
cd /workspace

# Configure git if not already configured
if [ -z "$(git config user.name)" ]; then
    git config user.name "Autocoder Bot"
    git config user.email "autocoder@example.com"
fi

# Check if Claude CLI is available
if command -v claude &> /dev/null; then
    if [ -n "$PROMPT" ]; then
        echo "Executing Claude with provided prompt..."
        # Run Claude in non-interactive mode with auto-acceptance of changes
        claude --print --dangerously-skip-permissions "$PROMPT"
    else
        echo "No prompt provided. Running in interactive mode."
        claude
    fi
else
    echo "Claude CLI not found. Attempting to install..."
    npm install -g @anthropic-ai/claude-code
    
    if command -v claude &> /dev/null; then
        if [ -n "$PROMPT" ]; then
            claude --print --dangerously-skip-permissions "$PROMPT"
        else
            claude
        fi
    else
        echo "Error: Failed to install Claude CLI"
        exit 1
    fi
fi

echo "=== Claude Code Agent Complete ==="
