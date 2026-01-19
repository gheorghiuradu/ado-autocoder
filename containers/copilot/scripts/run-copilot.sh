#!/bin/bash
set -e

PROMPT="$1"

echo "=== Running GitHub Copilot Agent ==="

# Ensure we're in the workspace
cd /workspace

# Configure git if not already configured
if [ -z "$(git config user.name)" ]; then
    git config user.name "Autocoder Bot"
    git config user.email "autocoder@example.com"
fi

# Check if GitHub Copilot CLI is available
if command -v gh &> /dev/null; then
    # Install GitHub Copilot CLI extension if not present
    if ! gh extension list | grep -q "gh-copilot"; then
        echo "Installing GitHub Copilot CLI extension..."
        gh extension install github/gh-copilot || echo "Warning: Could not install gh-copilot extension"
    fi
    
    if [ -n "$PROMPT" ]; then
        echo "Executing Copilot with provided prompt..."
        # Note: The actual Copilot CLI interface may vary
        # This is a placeholder for the actual implementation
        gh copilot suggest -t code "$PROMPT" || {
            echo "Warning: gh copilot suggest failed, falling back to direct implementation"
            # Fallback: Write prompt to a file for manual processing
            echo "$PROMPT" > /tmp/autocoder-prompt.txt
            echo "Prompt saved to /tmp/autocoder-prompt.txt"
        }
    else
        echo "No prompt provided. Running in interactive mode."
        gh copilot suggest -t code
    fi
else
    echo "Error: GitHub CLI (gh) is not available"
    exit 1
fi

echo "=== GitHub Copilot Agent Complete ==="
