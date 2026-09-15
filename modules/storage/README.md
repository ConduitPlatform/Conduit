# Storage

Authorization for containers, folders, and files. Client list-files is deferred.

## Client breaking changes

These apply to Storage Client routes and gRPC calls that use the user file handlers.

- **Missing containers are not created.** Creating or updating a file with a container that does not already exist returns `404 Not Found`. `allowContainerCreation` still only affects Admin implicit container creation.
- **Omitted folder becomes a personal folder.** If `folder` is omitted on Client file create, Storage uses `cnd_<userId>/`. Passing `/` still stores at the container root.
- **Personal-folder squat is denied.** Creating a missing `cnd_<otherUserId>/` path returns `403 Permission Denied`. When `authorization.enabled` is true, an existing but **unmanaged** `cnd_<otherUserId>/` root is also denied. A user may create their own `cnd_<userId>/`. If another user's personal root already exists **and is managed**, normal folder edit checks apply.
- **Scope create requires `edit`.** Creating a file with `scope` now requires `edit` on that scope, not `read`.

Admin-only container create remains available. Public file reads without auth (`getFile` / `getFileUrl`), module schema ownership, and existing public URI / CDN / content-disposition / local URL upload behavior are unchanged.

## Authorization tree

When `authorization.enabled` is true, Storage registers `Container`, `Folder`, and `File` resources and maintains owner relations that follow the path. There is **no** second `authorization.filesystem.enabled` flag.

- A container may own first-level folders, or files stored at `/`.
- A folder owns nested folders and files.
- Client file creates also stamp `scope ?? User:<id>` on the File so the creator can `can(File)` even if the folder has no owners yet.
- The default container is never owned. It is created on both the database and the storage provider if missing.
- An optional `scope` (for example `Team:<id>`) is attached as an extra owner when provided. Admin folder create without scope only attaches the container as the first-folder owner. Scope is optional and is not rejected when missing.

**Upgrade / leftover data:** there is no reconstruct-indexes job and old files are not backfilled. A leftover folder or non-default container with no owner/editor/reader relations is **unmanaged**: folder/container `can(edit)` is skipped, and the first successful write heals it by attaching the current subject (plus Container/parent links). After that, normal `can(edit)` applies. Old private files without a File relation stay Client-inaccessible; Admin can still read/update/delete them.

If Admin writes into a leftover (or new) folder **without** `scope`, the folder becomes container-owned. On the default container that means Client users will get `403` on later writes. That is expected. To keep the folder Client-writable, Admin must pass a `scope`, or let a Client user write first so they become the owner.

Folder delete removes nested folders/files and all of their relations. Container delete pages those cleanups and also clears `Container` relations. File moves always try to drop the old structural Folder/Container owner (ignore missing) and add the new one.

## Provisioning notes

- Provision named containers via **Admin**. Client APIs will not create them.
- For shared leftover folders that Client users should keep writing to, Admin should pass a `scope` (for example `Team:<id>`). Omitting scope is valid for Admin-only trees; it is not an error.
- Do **not** enable `authorization.enabled` until the product has a folder ownership model **and** either per-file grants or a privileged fetch path.
- Shared prefixes (`docs/`, team drops, fyllo-style common roots) become first-writer-wins on the first Client write after enable, then exclusive to that subject unless relations are granted.
- Fyllo-like apps that share prefixes should keep `authorization.enabled: false` until they do that separate product work. This module does not migrate those apps.
