#!/bin/bash
set -euo pipefail
HOST="${MONGO_HOST:-conduit-mongo}"
USER="${MONGO_INITDB_ROOT_USERNAME:-conduit}"
PASS="${MONGO_INITDB_ROOT_PASSWORD:-pass}"

until mongo --host "$HOST" -u "$USER" -p "$PASS" --authenticationDatabase admin --quiet --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; do
  sleep 2
done

mongo --host "$HOST" -u "$USER" -p "$PASS" --authenticationDatabase admin --quiet --eval '
  try {
    rs.status();
  } catch (err) {
    rs.initiate({
      _id: "rs0",
      members: [{ _id: 0, host: "'"$HOST"':27017" }]
    });
  }
'
