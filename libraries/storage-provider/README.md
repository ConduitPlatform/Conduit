---
name: Storage library
route: /storage-provider
menu: Development
---

# An storage provider library
This library can be used with anything really.

#STATUS
- Azure: Tested - working
- Google: Tested - not working
- Local: Not tested


# Local Storage (Test/Dev Usage only)
Disclaimer: This functionality is not built for production usage nor will it.

It simply stores files in the filesystem without checking for storage or access policies

# Google Cloud Storage
Allows you to connect with a Google Cloud Storage account by providing valid credentials

# Azure Blob Storage
Allows you to connect with an Azure storage account by providing a valid connection string.
Either a regular one or SAS connection string.

Limitations:
- Azure doesn't allow the client library to specify blob access. So making files public through this is not possible


