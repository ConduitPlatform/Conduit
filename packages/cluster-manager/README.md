# Cluster manager package
The cluster manager will use terraform to automatically spin-up new
pods in the kubernetes cluster, along with appropriate istio sidecars.

On a local mode, the manager will use the docker api to deploy containers
without the istio sidecars

The cluster manager will only run if conduit was started with the "managed"
flag/cli arg. In any other case, conduit will expect the dev to spin-up services,
this is to simplify local development.

The cases are the following:

- Local development
    - Developer runs conduit
    - Developer runs modules that they want
- Local testing/single VM
    - Admin runs conduit with managed flag, and the local argument
    - Conduit uses the cluster manager to communicate with docker and spin-up containers
- Kubernetes environment
    - Admin uses the provided deployment.yml or the helm chart(?)
    - Conduit gets spun-up in its own namespace with istio
    - Conduit uses the cluster manager to spin-up new pods with istio sidecars 
