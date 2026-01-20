addgroup coder --gid $HGID && adduser coder --uid $HID --gid $HGID --gecos "Coder" --disabled-password && \
su coder -c "copilot -p\"$1\" --yolo"