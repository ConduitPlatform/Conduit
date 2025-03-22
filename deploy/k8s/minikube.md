# Using Minikube 🚀

## Prerequisites
- Minikube installed, instructions [here](https://minikube.sigs.k8s.io/docs/start/).
- Helm installed, instructions [here](https://helm.sh/docs/intro/install/).

1. Start Minikube with `minikube start`.
2. `minikube addons enable ingress` to enable ingress access
3. `helm repo add conduit-platform https://conduitplatform.github.io/helm-charts/`
4. Get starter values from the values [folder](https://github.com/ConduitPlatform/Conduit/tree/main/deploy/k8s/values)
    - You can use either the `values.yaml` or the `values.dev.yaml` file. The difference is that .dev uses dev images,
while the other uses the latest stable images.
    - Make sure to change ingress hostnames if you want something different
5. `helm install -f values.yaml conduit conduit-platform/conduit`
6. Once the pods are healthy add to your hostsfile:
    ```
    # change to your defined hostnames if not using the default
    127.0.0.1 admin-api.conduit
    127.0.0.1 router.conduit
    127.0.0.1 admin.conduit
    ```
7. `minikube tunnel` (might request root access)
8. You can now access the [admin panel](http://admin.conduit) and the [router](http://router.conduit) in your browser.

