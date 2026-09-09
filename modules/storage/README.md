# Storage

Authorization for containers, folders, and files. Client list-files is deferred.

## Client breaking changes

These apply to Storage Client routes and gRPC calls that use the user file handlers.

- **Missing containers are not created.** Creating or updating a file with a container that does not already exist returns `404 Not Found`. `allowContainerCreation` still only affects Admin implicit container creation.
- **Omitted folder becomes a personal folder.** If `folder` is omitted on Client file create, Storage uses `cnd_<userId>/`. Passing `/` still stores at the container root.
- **Personal-folder squat is denied.** Creating a missing `cnd_<otherUserId>/` path returns `403 Permission Denied`. A user may create their own `cnd_<userId>/`. If another user's personal root already exists, normal folder edit checks apply.

Admin-only container create remains available. Public file reads without auth, module schema ownership, and existing public URI / CDN / content-disposition / local URL upload behavior are unchanged.

## Authorization tree

When `authorization.enabled` is true, Storage registers `Container`, `Folder`, and `File` resources and maintains owner relations that follow the path:

- A container may own first-level folders, or files stored at `/`.
- A folder owns nested folders and files.
- The default container is never owned. It is created on both the database and the storage provider if missing.
- An optional `scope` (for example `Team:<id>`) is attached as an extra owner when provided. Admin folder create without scope only attaches the container as the first-folder owner.

Folder delete removes nested folders/files and all of their relations. Container delete pages those cleanups and also clears `Container` relations.
