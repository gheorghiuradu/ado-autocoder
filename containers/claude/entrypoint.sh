#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: $0 <prompt>"
  exit 1
fi
if [ -z "$HID" ]; then
  HID=1000
fi
if [ -z "$HGID" ]; then
  HGID=1000
fi
if ! getent group $HGID > /dev/null 2>&1; then
    addgroup coder --gid $HGID
fi
if ! getent passwd $HID > /dev/null 2>&1; then
    adduser coder --uid $HID --gid $HGID --gecos "Coder" --disabled-password
fi

USERNAME=$(getent passwd $HID | cut -d: -f1)
usermod -aG sudo $USERNAME
passwd -d $USERNAME

PROMPT=$(echo "$1" | base64 -d)
su $USERNAME -c "claude --print --dangerously-skip-permissions \"$PROMPT\" > /out/autocoder.log 2>&1"
