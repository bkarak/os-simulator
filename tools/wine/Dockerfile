FROM debian:bookworm
ENV DEBIAN_FRONTEND=noninteractive
RUN dpkg --add-architecture i386 && apt-get update && \
    apt-get install -y --no-install-recommends wine wine32 xvfb xdotool imagemagick x11-utils fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*
ENV WINEDEBUG=-all WINEPREFIX=/root/.wine WINEARCH=win32
RUN xvfb-run -a wineboot -i || true
WORKDIR /oss
