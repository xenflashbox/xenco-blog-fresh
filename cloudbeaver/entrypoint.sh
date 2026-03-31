#!/bin/bash
# Custom CloudBeaver entrypoint that pre-configures the server

# Create workspace data directory if it doesn't exist
mkdir -p /opt/cloudbeaver/workspace/.data

# Copy the runtime config to make it writable
if [ -f /cloudbeaver-config/cloudbeaver.runtime.conf ]; then
    cp /cloudbeaver-config/cloudbeaver.runtime.conf /opt/cloudbeaver/workspace/.data/.cloudbeaver.runtime.conf
    chown dbeaver:dbeaver /opt/cloudbeaver/workspace/.data/.cloudbeaver.runtime.conf
    chmod 644 /opt/cloudbeaver/workspace/.data/.cloudbeaver.runtime.conf
    echo "Runtime configuration installed"
fi

# Execute the original entrypoint
exec /opt/cloudbeaver/run-server.sh
