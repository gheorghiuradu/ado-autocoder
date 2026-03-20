#!/bin/bash
# ado-pr-comment: Reply to an Azure DevOps pull request thread
#
# Usage: ado-pr-comment <threadId> <message>
#
# Required environment variables (injected by the Autocoder task runner):
#   AZURE_DEVOPS_TOKEN  - Personal Access Token or System.AccessToken
#   ADO_ORG_URL         - Organization URL (e.g. https://dev.azure.com/myorg/)
#   ADO_PROJECT         - Project name
#   ADO_REPO_ID         - Repository ID (GUID)
#   ADO_PR_ID           - Pull request ID

set -e

THREAD_ID="$1"
MESSAGE="$2"

if [ -z "$THREAD_ID" ] || [ -z "$MESSAGE" ]; then
    echo "Usage: ado-pr-comment <threadId> <message>" >&2
    exit 1
fi

for var in AZURE_DEVOPS_TOKEN ADO_ORG_URL ADO_PROJECT ADO_REPO_ID ADO_PR_ID; do
    eval val=\$$var
    if [ -z "$val" ]; then
        echo "Error: Required environment variable $var is not set" >&2
        exit 1
    fi
done

# Strip trailing slash from org URL
ORG_URL="${ADO_ORG_URL%/}"

API_URL="${ORG_URL}/${ADO_PROJECT}/_apis/git/repositories/${ADO_REPO_ID}/pullRequests/${ADO_PR_ID}/threads/${THREAD_ID}/comments?api-version=7.1"

# JSON-encode the message body (python3 is available in the container)
BODY=$(python3 -c "import json, sys; print(json.dumps({'content': sys.argv[1]}))" "$MESSAGE")

# Base64-encode credentials for Basic auth (format is :<token>)
AUTH=$(printf ':%s' "$AZURE_DEVOPS_TOKEN" | base64 -w 0)

HTTP_STATUS=$(curl -s -o /tmp/ado_pr_comment_response.json -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic ${AUTH}" \
    -d "$BODY" \
    "$API_URL")

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
    echo "Comment posted to thread #${THREAD_ID}"
else
    echo "Failed to post comment to thread #${THREAD_ID} (HTTP $HTTP_STATUS):" >&2
    cat /tmp/ado_pr_comment_response.json >&2
    exit 1
fi
