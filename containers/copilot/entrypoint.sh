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
    echo "Creating group with GID $HGID"
    addgroup coder --gid $HGID
fi
if ! getent passwd $HID > /dev/null 2>&1; then
    echo "Creating user with UID $HID"
    adduser coder --uid $HID --gid $HGID --gecos "Coder" --disabled-password --shell /bin/bash
fi

USERNAME=$(getent passwd $HID | cut -d: -f1)
echo "Using username: $USERNAME"
usermod -aG sudo $USERNAME
passwd -d $USERNAME

echo "$1"
echo "$1" | base64 -d
PROMPT=$(echo "$1" | base64 -d)
echo "Executing copilot with prompt $PROMPT"
su $USERNAME -c "copilot -p\"$PROMPT\" --yolo > /out/autocoder.log 2>&1"