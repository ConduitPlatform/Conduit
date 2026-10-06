#!/bin/bash
set -euo pipefail
HOST="${MONGO_HOST:-conduit-mongo}"
USER="${MONGO_INITDB_ROOT_USERNAME:-conduit}"
PASS="${MONGO_INITDB_ROOT_PASSWORD:-pass}"

mongo_eval() {
  mongo --host "$HOST" -u "$USER" -p "$PASS" --authenticationDatabase admin --quiet --eval "$1"
}

until mongo_eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; do
  sleep 2
done

# rs.status() returns { ok: 0 } before initiate; it does not throw.
mongo_eval '
  var status = rs.status();
  if (status.ok === 1) {
    quit(0);
  }
  var result = rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "'"$HOST"':27017" }]
  });
  if (result.ok !== 1) {
    printjson(result);
    quit(1);
  }
'

# Mongoose with replicaSet=rs0 only selects a PRIMARY (myState === 1).
until mongo_eval 'var s = rs.status(); if (s.ok === 1 && s.myState === 1) { quit(0); } quit(1);' >/dev/null 2>&1; do
  sleep 1
done
