---
name: In-memory Store
route: /in-memory
menu: Modules
---
# In memory storage module (DEPRECATED)

This module should work with the system's memory, reserving a configurable amount of RAM to use,
along with an eviction policy. It should also connect to in-memory stores like Redis & Memcache.d

DEPRECATION NOTICE
Currently conduit contains connection utilities for Redis inside the SDK. It'll not use a dedicated
module for in-memory store. The reason being that it would add uneccessary latency to the system through
the grpc calls required.

## Features

- Able to use system memory
- Contains eviction policy to use available memory without running out
- Connects to Redis
- Connects to Memcache.d
