FROM ubuntu:latest
ENV DEBIAN_FRONTEND=noninteractive
RUN apt update && apt install -y \
    curl \
    git \
    dotnet-sdk-10.0 \
    python3 \
    python3-pip \
    python-is-python3 \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash \
    && \. "$HOME/.nvm/nvm.sh" \
    && nvm install 24 \
    && curl -fsSL https://gh.io/copilot-install | bash \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]