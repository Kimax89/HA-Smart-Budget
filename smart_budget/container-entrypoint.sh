#!/bin/sh
set -eu
umask 077

# Supervisor preserves /data across upgrades. Migrate only our database files,
# including volumes created by the older root-running Home Assistant image.
mkdir -p "$DATA_DIR"
if [ "$(id -u)" = 0 ]; then
    chown node:node "$DATA_DIR"
    chmod 700 "$DATA_DIR"
    for file in "$DATA_DIR/budget.sqlite" "$DATA_DIR/budget.sqlite-wal" "$DATA_DIR/budget.sqlite-shm"; do
        if [ -f "$file" ]; then
            chown node:node "$file"
            chmod 600 "$file"
        fi
    done
    exec su-exec node:node "$@"
fi
exec "$@"
