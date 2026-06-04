variable "PLATFORMS" {
  default = ["linux/amd64", "linux/arm64"]
}

variable "BUILDING_SERVICE" {
  default = ""
}

target "docker-metadata-action" {}

target "_platforms" {
  platforms = PLATFORMS
}

target "conduit-base" {
  inherits = ["_platforms"]
  context  = "."
  dockerfile = "Dockerfile"
  args = {
    BUILDING_SERVICE = BUILDING_SERVICE
  }
}

target "conduit-builder" {
  inherits = ["_platforms"]
  context    = "scripts"
  dockerfile = "Dockerfile.builder"
  contexts = {
    conduit-base = "target:conduit-base"
  }
}

target "_runtime" {
  inherits = ["_platforms", "docker-metadata-action"]
  contexts = {
    conduit-base    = "target:conduit-base"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit" {
  inherits = ["_runtime"]
  context    = "packages/core"
  dockerfile = "Dockerfile"
}

target "authentication" {
  inherits = ["_runtime"]
  context    = "modules/authentication"
  dockerfile = "Dockerfile"
}

target "authorization" {
  inherits = ["_runtime"]
  context    = "modules/authorization"
  dockerfile = "Dockerfile"
}

target "chat" {
  inherits = ["_runtime"]
  context    = "modules/chat"
  dockerfile = "Dockerfile"
}

target "communications" {
  inherits = ["_runtime"]
  context    = "modules/communications"
  dockerfile = "Dockerfile"
}

target "database" {
  inherits = ["_runtime"]
  context    = "modules/database"
  dockerfile = "Dockerfile"
}

target "functions" {
  inherits = ["_runtime"]
  context    = "modules/functions"
  dockerfile = "Dockerfile"
}

target "router" {
  inherits = ["_runtime"]
  context    = "modules/router"
  dockerfile = "Dockerfile"
}

target "storage" {
  inherits = ["_runtime"]
  context    = "modules/storage"
  dockerfile = "Dockerfile"
}

target "conduit-standalone" {
  inherits = ["_platforms", "docker-metadata-action"]
  context    = "."
  dockerfile = "standalone.Dockerfile"
  contexts = {
    conduit-base = "target:conduit-base"
  }
}

group "all" {
  targets = [
    "conduit",
    "authentication",
    "authorization",
    "chat",
    "communications",
    "database",
    "functions",
    "router",
    "storage",
    "conduit-standalone",
  ]
}
