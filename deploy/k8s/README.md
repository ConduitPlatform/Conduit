# Kubernetes setup
Conduit was created with a k8s-first approach. While it can work in docker-swarm, compose and other orchestrators, the main focus is on k8s.

We've included some basic instructions to get you started on a local k8s cluster or a cloud one.

Current setup includes:
- [Minikube](minikube.md)
- [AKS](aks.md)

Embeddings is not part of the standalone image. Helm workload
`install.embeddings.enabled` (charts repo, default `false`) deploys the
process; module convict `enabled` is a separate Core config switch. For a
disabled-by-default embeddings rollout, capability/index readiness, and
rollback (`install.embeddings.enabled=false`, retained vector/index/config/
Redis state), see [embeddings.md](../embeddings.md). No embeddings image is
published until a compatible release tag exists.
