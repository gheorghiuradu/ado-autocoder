# Autocoder - Claude Code Container
# Base image: Ubuntu 22.04 LTS with common development tools
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install common dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install .NET SDK 8.0
RUN wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y dotnet-sdk-8.0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -s /bin/bash autocoder \
    && echo "autocoder ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up workspace directory
WORKDIR /workspace

# Copy entrypoint and scripts
COPY entrypoint.sh /entrypoint.sh
COPY scripts/ /scripts/
RUN chmod +x /entrypoint.sh /scripts/*.sh

# Switch to non-root user
USER autocoder

# Set environment variables
ENV HOME=/home/autocoder
ENV PATH="${HOME}/.local/bin:${PATH}"

# Install Claude CLI via npm (as autocoder user)
RUN npm install -g @anthropic-ai/claude-code || echo "Note: Claude CLI will be installed at runtime if needed"

# Entrypoint
ENTRYPOINT ["/entrypoint.sh"]
