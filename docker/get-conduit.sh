#!/bin/sh

TAG=master

curl -L https://raw.githubusercontent.com/ConduitPlatform/Conduit/$TAG/docker/Makefile > Makefile
make zero-to-hero
