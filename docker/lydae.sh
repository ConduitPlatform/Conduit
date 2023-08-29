#!/bin/sh

profileStr="--profile mongodb --profile ui --profile chat --profile email --profile forms --profile push-notifications --profile sms --profile storage"

if [ "$1" = "start" ]; then
    docker compose $profileStr up -d
elif [ "$1" = "stop" ]; then
    docker compose $profileStr down
elif [ "$1" = "rm" ]; then
    docker compose $profileStr rm
else
    echo "Example Usage: lydae.sh <mode>"
    echo "Available Modes: start, stop, rm"
fi
