# Kubernetes setup
Conduit was created with a k8s-first approach. While it can work in docker-swarm, compose and other orchestrators, the main focus is on k8s.

We've included some basic instructions to get you started on a local k8s cluster or a cloud one.

Current setup includes:
- [Minikube](minikube.md)
- [AKS](aks.md)

Embeddings is not part of the standalone image. For a disabled-by-default
embeddings rollout, capability/index readiness, and rollback, see
[embeddings.md](../embeddings.md). Helm values live in the charts repository.
