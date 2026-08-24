variable "PLATFORMS" {
  default = ["linux/amd64", "linux/arm64"]
}

variable "BUILDING_SERVICE" {
  default = ""
}

variable "BUILD_BUNDLE" {
  default = "0"
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
    BUILDING_SERVICE  = BUILDING_SERVICE
    BUILD_BUNDLE = BUILD_BUNDLE
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

target "conduit-base-bundle-conduit" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "packages/core"
    BUILD_BUNDLE     = "1"
  }
}

target "conduit" {
  inherits = ["_runtime"]
  context    = "packages/core"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-conduit"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-authentication" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/authentication"
    BUILD_BUNDLE     = "1"
  }
}

target "authentication" {
  inherits = ["_runtime"]
  context    = "modules/authentication"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-authentication"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-authorization" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/authorization"
    BUILD_BUNDLE     = "1"
  }
}

target "authorization" {
  inherits = ["_runtime"]
  context    = "modules/authorization"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-authorization"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-chat" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/chat"
    BUILD_BUNDLE     = "1"
  }
}

target "chat" {
  inherits = ["_runtime"]
  context    = "modules/chat"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-chat"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-functions" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/functions"
    BUILD_BUNDLE     = "1"
  }
}

target "conduit-base-bundle-communications" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/communications"
    BUILD_BUNDLE     = "1"
  }
}

target "communications" {
  inherits = ["_runtime"]
  context    = "modules/communications"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-communications"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-database" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/database"
    BUILD_BUNDLE     = "1"
  }
}

target "database" {
  inherits = ["_runtime"]
  context    = "modules/database"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-database"
    conduit-builder = "target:conduit-builder"
  }
}

target "functions" {
  inherits = ["_runtime"]
  context    = "modules/functions"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-functions"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-router" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/router"
    BUILD_BUNDLE     = "1"
  }
}

target "router" {
  inherits = ["_runtime"]
  context    = "modules/router"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-router"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-base-bundle-storage" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = "modules/storage"
    BUILD_BUNDLE     = "1"
  }
}

target "storage" {
  inherits = ["_runtime"]
  context    = "modules/storage"
  dockerfile = "Dockerfile"
  contexts = {
    conduit-base    = "target:conduit-base-bundle-storage"
    conduit-builder = "target:conduit-builder"
  }
}

target "conduit-standalone" {
  inherits = ["_platforms", "docker-metadata-action"]
  context    = "."
  dockerfile = "standalone.Dockerfile"
  contexts = {
    conduit-base = "target:conduit-base-bundle-standalone"
  }
}

target "conduit-base-bundle-standalone" {
  inherits = ["conduit-base"]
  args = {
    BUILDING_SERVICE = ""
    BUILD_BUNDLE     = "1"
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
