# Using AKS 🚀

## Prerequisites
- Provision an AKS cluster, instructions [here](https://docs.microsoft.com/en-us/azure/aks/kubernetes-walkthrough).
- Set up an Ingress Controller of your choosing
- Set up your Azure CLI and kubectl, or use the command execute in your Azure portal

## Caveats
- Conduit tends to have connectivity issues with Azure CNI. Although that's not always the case, we cannot guarantee it will work as expected.

## Instructions
1. `helm repo add conduit-platform https://conduitplatform.github.io/helm-charts/`
2. Get starter values from the values [folder](https://github.com/ConduitPlatform/Conduit/tree/main/deploy/k8s/values)
    - You can use either the `values.yaml` or the `values.dev.yaml` file. The difference is that .dev uses dev images,
      while the other uses the latest stable images.
    -   ⚠️ Make sure to change the hostnames in the ingress section to match your setup. ⚠️
3. `helm install -f values.yaml conduit conduit-platform/conduit`
4. Open the admin panel in your browser.

## Best practices
- ⚠️Make sure to change your root admin password ASAP, so that your deployment is not compromised. ⚠️
- We generally advise to set up Prometheus, Loki and your database using official charts and proper configuration.
  The default configurations of the chart are for development and demo purposes.

