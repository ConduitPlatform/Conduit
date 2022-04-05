#!/bin/sh

TAG=main

curl -L https://raw.githubusercontent.com/ConduitPlatform/Conduit/$TAG/docker/Makefile > Makefile
make zero-to-hero
