# Container image CI

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [images.build.yml](workflows/images.build.yml) | `push` to `main`, `release`, `workflow_dispatch` | Multi-arch (`linux/amd64`, `linux/arm64`) images to GHCR; release also pushes Docker Hub |
| [production.yaml](workflows/production.yaml) | `release` | npm SDK publish only (not container images) |

## Build architecture

Each image is built natively per platform, then merged into a manifest list:

| Job | Runner | Platform |
|-----|--------|----------|
| `build_amd64` | `ubuntu-24.04` | `linux/amd64` |
| `build_arm64` | `ubuntu-24.04-arm` | `linux/arm64` |
| `manifest` | `ubuntu-24.04` | merges digests into tagged manifest |

Platform builds push by digest to GHCR (no tags). The `manifest` job applies dev or release tags via `docker buildx imagetools create`. Release also mirrors the GHCR manifest to Docker Hub.

## Tags

| Channel | GHCR | Docker Hub | `:latest` |
|---------|------|------------|-----------|
| `main` push | `ghcr.io/conduitplatform/<image>:dev` | — | — |
| Stable release | `:<version>` | `conduitplatform/<image>:<version>` | yes |
| Prerelease / alpha / beta / rc | `:<version>` | `:<version>` | no |

## Validation

`docker buildx imagetools inspect ghcr.io/conduitplatform/database:dev` should list `linux/amd64` and `linux/arm64`.

## Local builds

```bash
docker buildx bake --file docker-bake.hcl --print database
./scripts/docker-build.sh database
```
