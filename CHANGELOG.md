# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.12.5](https://github.com/ConduitPlatform/Conduit/compare/v0.12.4...v0.12.5) (2022-04-04)


### Features

* **authentication,config:** remove Authentication's dependency on Email for unverified local email auth strategies ([#103](https://github.com/ConduitPlatform/Conduit/issues/103)) ([9574848](https://github.com/ConduitPlatform/Conduit/commit/9574848c2a987eecdd6cd3a14c221866f0c2831b))


### Bug Fixes

* **authentication:** googleHandlers being validated in place of githubHandlers ([#101](https://github.com/ConduitPlatform/Conduit/issues/101)) ([f9693ec](https://github.com/ConduitPlatform/Conduit/commit/f9693ec4aa4f322dead6af380f872876c7ae19aa))
* **chat:** createRoom, addUserToRoom app routes ([#108](https://github.com/ConduitPlatform/Conduit/issues/108)) ([bb53227](https://github.com/ConduitPlatform/Conduit/commit/bb53227ec6da501493a6e6913413f679775085eb))
* **database:** createCustomEndpointRoute argument type changed ([#97](https://github.com/ConduitPlatform/Conduit/issues/97)) ([51b5d34](https://github.com/ConduitPlatform/Conduit/commit/51b5d3412f2a1e994ba7088ddb2dc7bf7ad88fe5))
* **email,authentication,forms:** email activation bus event pub/sub ([#105](https://github.com/ConduitPlatform/Conduit/issues/105)) ([7ea82f8](https://github.com/ConduitPlatform/Conduit/commit/7ea82f836c5900804c65284bc4825b2e73718554))
* **router:** socket emits ([#109](https://github.com/ConduitPlatform/Conduit/issues/109)) ([9b88a52](https://github.com/ConduitPlatform/Conduit/commit/9b88a52104de947eeb0da53b1378eff2d60cde9b))

### [0.12.4](https://github.com/ConduitPlatform/Conduit/compare/v0.12.3...v0.12.4) (2022-03-29)


### Bug Fixes

* **core:** socket pushes not working ([#82](https://github.com/ConduitPlatform/Conduit/issues/82)) ([d4232ef](https://github.com/ConduitPlatform/Conduit/commit/d4232eff7b69ccbea3d081eadf74239bb341939d))
* **database:** custom endpoint handler was not assigned properly ([4622540](https://github.com/ConduitPlatform/Conduit/commit/4622540f69b1ee32fcf9b8e647b6ebf2737fc7e7))
* **grpc-sdk:** remove stringification of strings ([866f982](https://github.com/ConduitPlatform/Conduit/commit/866f982662cd41b16c0909da8e32be3849e2ea3a))
* **router,admin:** admin requests not passing through master key middleware ([#88](https://github.com/ConduitPlatform/Conduit/issues/88)) ([09204bd](https://github.com/ConduitPlatform/Conduit/commit/09204bd0494cc5bbe769e6cfcc552233cb6ea181))
* **router:** excessive REST router refreshes ([#90](https://github.com/ConduitPlatform/Conduit/issues/90)) ([8adc549](https://github.com/ConduitPlatform/Conduit/commit/8adc549a09807d353f730ed576e1f884c788cbb2))

### [0.12.3](https://github.com/ConduitPlatform/Conduit/compare/v0.12.2...v0.12.3) (2022-03-21)

### Features
* **storage:** add support for Amazon S3([#75](https://github.com/ConduitPlatform/Conduit/pull/75)) ([9886191](https://github.com/ConduitPlatform/Conduit/commit/98861914c1fd6742645663046879c58effbf259c))

### Bug Fixes

* **router, admin:** Admin Swagger headers and route paths ([#83](https://github.com/ConduitPlatform/Conduit/issues/83)) ([594bfec](https://github.com/ConduitPlatform/Conduit/commit/594bfec1e25b907fe3bf3a40a1f4a1f9d679db40))
* **router:** GraphQL delays due to repetitive refreshes ([#71](https://github.com/ConduitPlatform/Conduit/issues/71)) ([996e90b](https://github.com/ConduitPlatform/Conduit/commit/996e90bd358835aae0b176548d40c6a4ba7441f1))
* **storage:** updateFile handler storing undefined filename when no name param provided and folder param workaround ([#73](https://github.com/ConduitPlatform/Conduit/issues/73)) ([b3d624f](https://github.com/ConduitPlatform/Conduit/commit/b3d624f889865c646a33de84c0f929695347ddee))

### [0.12.2](https://github.com/ConduitPlatform/Conduit/compare/v0.12.1...v0.12.2) (2022-03-04)


### Bug Fixes

* **authentication:** local auth not enabled due to config field typo ([#64](https://github.com/ConduitPlatform/Conduit/issues/64)) ([c77382d](https://github.com/ConduitPlatform/Conduit/commit/c77382d1e9fb9c157e073f17a41bf2209630d1b6))
* **grpc-sdk:** route rpc strings not generated for function names comprised of registered subsets" ([#65](https://github.com/ConduitPlatform/Conduit/issues/65)) ([51e14b8](https://github.com/ConduitPlatform/Conduit/commit/51e14b81b2ee64363dfa3fa0720e483f7ebf21e7))

### [0.12.1](https://github.com/ConduitPlatform/Conduit/compare/v0.12.0...v0.12.1) (2022-02-28)


### Bug Fixes

* **database:** missing escape-string-regexp ([1897b9b](https://github.com/ConduitPlatform/Conduit/commit/1897b9b5b05f22e2a4e64424f39987f9274dbf04))
* **database:** schema migrations from CMS not working properly ([#59](https://github.com/ConduitPlatform/Conduit/issues/59)) ([b81774c](https://github.com/ConduitPlatform/Conduit/commit/b81774c6af7d85c92da88c4c7bcdb2ce92d02057))

## [0.12.0](https://github.com/ConduitPlatform/Conduit/compare/v0.11.1...v0.12.0) (2022-02-25)


### ⚠ BREAKING CHANGES

* - All /admin/cms/* routes are now available under /database/cms
- [GET] /admin/database/schemas/extensions return definition change
  'declaredSchemaExtensions' -> 'schemaExtensions'

* fix(database): unparsed ints in getCustomEndpoints due to route definition missing skip,limit query params

* feat(database): getSchemasWithCustomEndpoints admin route

* chore(cms,grpc-sdk): delete CMS module

Co-authored-by: Konstantinos Feretos <konferetos@tutanota.com>
* GetFormReplies now properly accepts form id as a url param
* ConduitServiceModule does not receive a ConduitGrpcSdk arg anymore.
Constructors of modules extending ConduitServiceModule directly should explicitly set this.grpcSdk instead of passing it as an arg to base constructor.

* chore(grpc-sdk,authentication): requested changes

### Features

* **cms:** getCustomEndpoints schemaName array filter ([#45](https://github.com/ConduitPlatform/Conduit/issues/45)) ([b6955c3](https://github.com/ConduitPlatform/Conduit/commit/b6955c3b932546d9f1276c9b21aedde9782678a1))


### Bug Fixes

* **authentication:** ConfigController import ([#46](https://github.com/ConduitPlatform/Conduit/issues/46)) ([35f87e0](https://github.com/ConduitPlatform/Conduit/commit/35f87e001a23433746a84a48eba1bfeae61ec160))
* **grpc-sdk:** import in ConduitParser.ts ([98099ca](https://github.com/ConduitPlatform/Conduit/commit/98099cafd5db50626d9cebea7a3bd8f073ed01f0))
* **grpc-sdk:** missing convict dependency ([4a58e66](https://github.com/ConduitPlatform/Conduit/commit/4a58e66705c24a856ed49970007322639c6cb2a8))
* **grpc-sdk:** scope resolution in promise ([#50](https://github.com/ConduitPlatform/Conduit/issues/50)) ([81015f8](https://github.com/ConduitPlatform/Conduit/commit/81015f84085dcee8473d10e1c0d550e16f7fb38b))


* Cms db merge (#53) ([f5b054b](https://github.com/ConduitPlatform/Conduit/commit/f5b054be4cc42bc8ea500f8c7f3e2e3854e43da2)), closes [#53](https://github.com/ConduitPlatform/Conduit/issues/53)
* ManagedModule Refactor for Forms (#52) ([2d9777f](https://github.com/ConduitPlatform/Conduit/commit/2d9777f277a53c474b5437588dcc3780c671d69f)), closes [#52](https://github.com/ConduitPlatform/Conduit/issues/52)
* Module initialization using lifecycle hooks (ManagedModule) (#44) ([de28fc7](https://github.com/ConduitPlatform/Conduit/commit/de28fc7e53ba4dc656ddb6063a918c9b3c363d39)), closes [#44](https://github.com/ConduitPlatform/Conduit/issues/44)

### [0.11.1](https://github.com/ConduitPlatform/Conduit/compare/v0.11.0...v0.11.1) (2022-02-18)

## [0.11.0](https://github.com/ConduitPlatform/Conduit/compare/v0.10.6...v0.11.0) (2022-02-17)


### ⚠ BREAKING CHANGES

* **cms:** Removed CMS.getSchemasFromOtherModules (GET: /admin/cms/schemasFromOtherModules)

* feat(cms): remove getSchemas hackery for system schemas
* **cms:** CMS.CreateDocuments URI is now
[POST]: /admin/cms/schemas/:schemaName/docs/many
* Dynamically generated form submission URIs now use the form's '_id' field.
* Affected routes now return 'count'
CMS.GetDocuments (GET: /admin/cms/query/:schemaName)
CMS.GetSchemas   (GET: /admin/cms/schemas)
CMS.getDocuments (GET: /admin/cms/${schemaName})
Chat.GetRooms               (GET: /admin/chat/rooms)
Database.GetDeclaredSchemasExtensions (GET: /admin/database/schemas/extensions)
Email.GetTemplates          (GET: /admin/email/templates)
Email.GetExternalTemplates  (GET: /admin/email/externalTemplates)
Email.SyncExternalTemplates (PUT: /admin/email/syncExternalTemplates)
Forms.DeleteForms           (DELETE: /admin/forms/delete)
Payments.GetProducts        (GET: /admin/payments/products)
Payments.GetCustomers       (GET: /admin/payments/customer)
Payments.GetTransactions    (GET: /admin/payments/transactions)
Payments.GetSubscriptions   (GET: /admin/payments/subscriptions)
[GET] /admin/cms/schemasFromOtherModules now returns 'externalSchemas'
Authentication.RenewServiceToken now accepts serviceId as a url param
Authentication.RenewServiceToken PUT: /admin/authentication/services -> /admin/authentication/services/:id/token
Authentication.ToggleUsers: POST: /admin/authentication/users/toggle -> /admin/authentication/users/many/toggle
Authentication.DeleteUsers: DELETE: /admin/authentication/users -> /admin/authentication/users/many
Chat.DeleteRooms:    DELETE: /admin/chat/rooms -> /admin/chat/rooms/many
Chat.DeleteMessages: DELETE: /admin/chat/messages -> /admin/chat/messages/many
CMS.DeleteSchemas:   DELETE: /admin/cms/schemas -> /admin/cms/schemas/many
CMS.ToggleSchema:    PUT: /admin/cms/schemas/toggle/:id -> /admin/cms/schemas/:id/toggle
CMS.ToggleSchemas:   PUT: /admin/cms/schemas/toggle -> /admin/cms/schemas/many/toggle
CMS.SetSchemaPermissions: PATCH: /admin/cms/schemas/permissions/:id -> /admin/cms/schemas/:id/permissions
CMS.GetDocument:     GET: /admin/cms/content/:schemaName/:id -> /admin/cms/schemas/:schemaName/docs/:id
CMS.GetDocuments:    GET: /admin/cms/query/:schemaName -> /admin/cms/schemas/:schemaName/docs
CMS.CreateDocument:  POST: /admin/cms/content/:schemaName -> /admin/cms/schemas/:schemaName/docs
CMS.CreateDocuments: POST: /admin/cms/content/:schemaName/many -> /admin/cms/schemas/:schemaName/docs/many
CMS.UpdateDocument:  POST: /admin/cms/schemas/:schemaName/:id -> /admin/cms/schemas/:schemaName/docs/:id
CMS.UpdateDocuments: POST: /admin/cms/schemas/:schemaName/many -> /admin/cms/schemas/:schemaName/docs/many
CMS.DeleteDocument:  DELETE: /admin/cms/schemas/:schemaName/:id -> /admin/cms/schemas/:schemaName/docs/:id
Email.DeleteTemplates: DELETE: /admin/email/templates -> /admin/email/templates/many
Forms.GetForms:      GET /admin/forms/get -> /admin/forms/forms
Forms.CreateForm:    POST /admin/forms/new -> /admin/forms/forms
Forms.UpdateForm:    POST /admin/forms/update/:formId -> /admin/forms/forms/:formId
Forms.DeleteForms:   DELETE /admin/forms/delete -> /admin/forms/forms
Forms.GetFormReplies: GET /admin/forms/replies/:formId -> /admin/forms/forms/:formId/replies
Payments.GetCustomers: GET /admin/payments/customer -> /admin/payments/customers
Payments.CreateCustomer: POST /admin/payments/customer -> /admin/payments/customers
Storage.GetFile:     GET /admin/file/:id -> /admin/files/:id
Storage.GetFiles:    GET /admin/file -> /admin/files
Storage.CreateFiles: POST /admin/file -> /admin/files
Storage.PatchFile:   PATCH /admin/file/:id -> /admin/files/:id
Storage.DeleteFile:  DELETE /admin/file/:id -> /admin/files/:id
Storage.GetFileUrl:  GET /admin/getFileUrl/:id -> /admin/files/:id/url
Storage.GetFileData: GET /admin/files/:id/data -> /admin/files/:id/data
Storage.GetFolders:  GET /admin/storage/folder -> /admin/storage/folders
Storage.CreateFolder: POST /admin/storage/folder -> /admin/storage/folders
Storage.DeleteFolder: DELETE /admin/storage/folder/:id -> /admin/storage/folders/:id
Storage.GetContainers: GET /admin/storage/container -> /admin/storage/containers
Storage.CreateContainer: POST /admin/storage/container -> /admin/storage/containers
Storage.DeleteContainer: DELETE /admin/storage/container/:id -> /admin/storage/containers/:id
CMS.ToggleSchema: /admin/cms/schemas/:id/toggle [PUT -> POST]
CMS.ToggleSchemas: /admin/cms/schemas/many/toggle [PUT -> POST]
Authentication.RenewServiceToken: /admin/authentication/services/:serviceId/token [PUT -> GET]
Authentication.DeleteUsers: [DELETE] /admin/authentication/users/many -> /admin/authentication/users
Authentication.ToggleUsers: [POST] /admin/authentication/users/many/toggle -> /admin/authentication/users/toggle
Chat.DeleteRooms:     [DELETE]  /admin/chat/rooms/many -> /admin/chat/rooms
Chat.DeleteMessages:  [DELETE]  /admin/chat/messages/many -> /admin/chat/messages
CMS.DeleteSchemas:    [DELETE]  /admin/cms/schemas/many ->/admin/cms/schemas
CMS.ToggleSchemas:    [POST]    /admin/cms/schemas/many/toggle -> /admin/cms/schemas/toggle
CMS.GetDocuments:  *  [POST]  * /admin/cms/schemas/:schemaName/docs/many -> /admin/cms/schemas/:schemaName/query
CMS.UpdateDocuments   [PUT]:    /admin/cms/schemas/:schemaName/docs/many -> /admin/cms/schemas/:schemaName/docs
Email.DeleteTemplates [DELETE]: /admin/email/templates/many -> /admin/email/templates
Forms.DeleteForms     [DELETE]: /admin/forms/forms/many -> /admin/forms/forms
* Affected routes' 'ids' field moved to queryParams
- Authentication.DeleteUsers
- Chat.DeleteRooms
- Chat.DeleteMessages
- CMS.DeleteSchemas
- Email.DeleteTemplates
- Forms.DeleteForms
* Authentication.DeleteService: id is now a urlParam
Forms.GetReplies [GET]: /admin/forms/forms/:formId/replies -> /admin/forms/replies
Forms.GetReplies [GET]: /admin/forms/replies now acceps formId as a query parameter
* **cms,sms,push-notifications,authentication:** Affected route return types differ
* **cms:** getSchemas now directly returns 'schemas' and 'documentsCount'
* **modules,grpc-sdk:** renamed SERVICE_URL module env variable to SERVICE_IP
* **storage:** using id to delete folder,container instead of using name and container
* **storage:** return types of admin and non-admin routes getFile, createFile, editFile changed
* **database:** renamed database-provider to 'database'
* **security:** CreateSecurityClient return field nesting
* **config:** GetConfig and UpdateConfig return field nesting

### Features

* **actor,authentication,chat,cms,forms,payments:** use nullish coalescing for optional params ([50d2666](https://github.com/ConduitPlatform/Conduit/commit/50d26662ab66928c1efc3c2f303684e427f6732b))
* **actor:** return type referencing of GetFlow in GetFlows ([e2d18e8](https://github.com/ConduitPlatform/Conduit/commit/e2d18e89e36bec04936de462a9975611b319f996))
* **admin,security:** exclude Admin Swagger route from admin, auth middlewares while in dev mode ([d3f63cd](https://github.com/ConduitPlatform/Conduit/commit/d3f63cd0f7925f1759901e101cc9613bda78b0e4))
* **authentication:** user provider metadata stored in database ([#39](https://github.com/ConduitPlatform/Conduit/issues/39)) ([3863224](https://github.com/ConduitPlatform/Conduit/commit/38632241fc619ebd8681b65bf88ba7ce202b89bc))
* **cms,database,commons,grpc-sdk:** phase out SchemaDefinitions ([a48fcef](https://github.com/ConduitPlatform/Conduit/commit/a48fcef6cad6e9e585399ee16ede06ba2085b708))
* **cms,grpc-sdk,commons:** add permission params to createSchema, editSchema ([58d8d37](https://github.com/ConduitPlatform/Conduit/commit/58d8d375ac8c2e378f129aed1a5a23bde7783af2))
* **cms:** GetCustomEndpoints pagination and count ([886b7d9](https://github.com/ConduitPlatform/Conduit/commit/886b7d9a5e754b298b6c9cf4275a745beae07f17))
* **cms:** implement setSchemaPermission admin route ([bee726e](https://github.com/ConduitPlatform/Conduit/commit/bee726e303344054ef68113c270a3dde5b9706a8))
* **cms:** migrate SchemaDefinitions -> _DeclaredSchema ([2fd0d07](https://github.com/ConduitPlatform/Conduit/commit/2fd0d07f4f02df065ae61300972e747f042ca493))
* **cms:** remove cms-only filtering from getSchema, getSchemas ([#21](https://github.com/ConduitPlatform/Conduit/issues/21)) ([40a9d88](https://github.com/ConduitPlatform/Conduit/commit/40a9d889ba47c32a37028b8cd48d28e8b260b22f))
* **commons,router:** add routerName string arg to grpcToConduitRoute() ([decb592](https://github.com/ConduitPlatform/Conduit/commit/decb592522b41caf4807fb85ee7f7ced7bb035f8))
* **database,cms,grpc-sdk:** schema extensions ([#35](https://github.com/ConduitPlatform/Conduit/issues/35)) ([d8ff954](https://github.com/ConduitPlatform/Conduit/commit/d8ff9540bde68735173a889e071cc5db2cfd567d))
* **database:** add permission checks for creation, modification, deletion, extension ([7c15ee4](https://github.com/ConduitPlatform/Conduit/commit/7c15ee4a4e02c3df30c74393330063f0b7204eee))
* **database:** Database admin route, GetDeclaredSchemas() ([bce969c](https://github.com/ConduitPlatform/Conduit/commit/bce969c76505cf4d528a0bfeb0e1bd7825134fed))
* **database:** migrate _DeclaredSchema.modelOptions ([3e74bf6](https://github.com/ConduitPlatform/Conduit/commit/3e74bf6c019ea6fdaebe44a359ff0723d5ddd7bb))
* **examples:** update custom module example implementation [#20101](https://github.com/ConduitPlatform/Conduit/issues/20101)w7 ([#521](https://github.com/ConduitPlatform/Conduit/issues/521)) ([eb9029a](https://github.com/ConduitPlatform/Conduit/commit/eb9029a0f92e8286a3cf6a9573767a549e6e1ec2)), closes [#20101w7](https://github.com/ConduitPlatform/Conduit/issues/20101w7)
* **grpc-sdk,commons,admin,config,database,cms:** remove ConduitModelOptions.systemRequired ([8228712](https://github.com/ConduitPlatform/Conduit/commit/8228712802abb178aff0f31d2d04e59f8713d425))
* **grpc-sdk,commons,security,modules:** schema permissions ([c307991](https://github.com/ConduitPlatform/Conduit/commit/c3079919f97b08da6453fa82474862ca5e8d7d7c))
* **grpc-sdk:** provide module name in grpc requests ([6c4116c](https://github.com/ConduitPlatform/Conduit/commit/6c4116ca0d451c93b4aeae40629040f0561a9746))
* **modules,grpc-sdk:** module SERVICE_IP env variable (eg: '0.0.0.0:5000') ([fe0c3d0](https://github.com/ConduitPlatform/Conduit/commit/fe0c3d0188d72f6c8e6477298083b72325c2c4df))
* **readme:** fix md formatting, add tables and code blocks, improve run commands ([#1](https://github.com/ConduitPlatform/Conduit/issues/1)) ([2982079](https://github.com/ConduitPlatform/Conduit/commit/2982079da23df42b0cea6384a53b66730e6aa466))
* **router:** add support for required bodyParams to SwaggerParser ([85b6411](https://github.com/ConduitPlatform/Conduit/commit/85b6411f242723cd8b6d9176b1958c86cb23bd40))
* **router:** implement SwaggerParser ([bfc18c2](https://github.com/ConduitPlatform/Conduit/commit/bfc18c224683ee3b2401710161803833d3d7d66a))
* **security,modules:** specify sane initial schema permissions ([7f93019](https://github.com/ConduitPlatform/Conduit/commit/7f930192ea7052f5841938b531277771de9c2ccf))
* **storage:** delete , create folder and container at local storage ([02707af](https://github.com/ConduitPlatform/Conduit/commit/02707af1b5004d759148bfeea821b49dd9c3a0ba))
* **storage:** return type referencing of GetFile in GetFiles ([e0ce43c](https://github.com/ConduitPlatform/Conduit/commit/e0ce43c50345335578bb01bc35ae45c793dea7dd))


### Bug Fixes

* **actor,chat,cms,payments,storage:** remove return field encapsulation ([25d1b7a](https://github.com/ConduitPlatform/Conduit/commit/25d1b7a278df11996111d830ad03ff9fc2dd5904))
* **admin,config,security,actor,authentication,chat,cms,database,email,forms,payments,push-notifications,storage:** add missing {required: true} to required schema fields ([bfbd17c](https://github.com/ConduitPlatform/Conduit/commit/bfbd17cd4a23b1637415edb61691a42f6d327f42))
* **admin,config,security:** unnest ConduitRouteReturnDefinition return fields from 'result' ([18aae8f](https://github.com/ConduitPlatform/Conduit/commit/18aae8f3e0057737c88f8b6b63b89f4c4d5ed915))
* **admin:** core package routes not registered ([fd26b21](https://github.com/ConduitPlatform/Conduit/commit/fd26b214da9c4c490f46a064fb5d7c8a90e91114))
* **admin:** login routing check in auth middleware ([460e5d3](https://github.com/ConduitPlatform/Conduit/commit/460e5d356d98d89659d5ed5f79f3595e4ed624ce))
* **admin:** routes not working properly ([4b114a1](https://github.com/ConduitPlatform/Conduit/commit/4b114a1a5412b5ecb57ab2f08e34266201665d6b))
* **authentication,cms,email,payments,storage:** PATCH handlers exposed through PUT routes ([d35a6f4](https://github.com/ConduitPlatform/Conduit/commit/d35a6f4d98b825d3c0e88a8c0e4ce26edbd39928))
* **authentication:** enableTwoFa handler returning object message ([#537](https://github.com/ConduitPlatform/Conduit/issues/537)) ([02dc145](https://github.com/ConduitPlatform/Conduit/commit/02dc14578fba8613c717f4f9976da6c83e13cfd1))
* **authentication:** fix ConduitActiveSchema initialization order ([c5092ee](https://github.com/ConduitPlatform/Conduit/commit/c5092ee7fc7b9eaa7ea0f970f6a7458b867b394e))
* **authentication:** import issues ([12f840d](https://github.com/ConduitPlatform/Conduit/commit/12f840da05f6d82be2a08ec999c7dfe422fbbfdd))
* **authentication:** type fix ([1deccf8](https://github.com/ConduitPlatform/Conduit/commit/1deccf8a14de63d9f51491dc471b306f42f7e74e))
* **chat,cms,payments:** remove implicit populate queryParam ([9e9972a](https://github.com/ConduitPlatform/Conduit/commit/9e9972ac7fc9809bc77ba5edbd93246f4f3bd0a5))
* **chat,payments,push-notifications:** reference model User overwriting original schema ownership ([c4b6be4](https://github.com/ConduitPlatform/Conduit/commit/c4b6be498c5c71e700ddef8c6164c43645822b4e))
* **chat:** leaveRoom fixed ([cce0a54](https://github.com/ConduitPlatform/Conduit/commit/cce0a548333143ed8c484db970a4329f0104517d))
* CMS route GetSchemasFromOtherModules ([e6431c4](https://github.com/ConduitPlatform/Conduit/commit/e6431c4ebeffb7edf85cb224430e7a4655448b78))
* **cms:** cheking whenever a field exists ([1d9145f](https://github.com/ConduitPlatform/Conduit/commit/1d9145f8fba289cb889626e778a203cb92716742))
* **cms:** createCustomEndpoint valid operation check and route handler name ([f0e0191](https://github.com/ConduitPlatform/Conduit/commit/f0e019151ed4b3c1c925ee6ea265d276e0948eff))
* **cms:** Declared schema not initializing properly ([e70ab3d](https://github.com/ConduitPlatform/Conduit/commit/e70ab3dd596a51628687b451ebe991982a18893a))
* **cms:** duplicate route of POST  /content/schemaName ([0d6266e](https://github.com/ConduitPlatform/Conduit/commit/0d6266eec83e4a4452556559ad8ac51582286c91))
* **cms:** editDocument argument must be of type ConduitJson ([5fd7374](https://github.com/ConduitPlatform/Conduit/commit/5fd7374b8168f7512ad48e65aad845e9c2d1b756))
* **cms:** GetDocuments() must be POST request. Query var must be of type JSON. ([49e38b7](https://github.com/ConduitPlatform/Conduit/commit/49e38b754a1fb03f66913c2c2a5b74c77c90db3f))
* **cms:** GetSchemas enabled accidentally required ([2a19ceb](https://github.com/ConduitPlatform/Conduit/commit/2a19cebe4dd38b533320f345d95e38b14e7671ab))
* **cms:** getSchemas handler ([15572e5](https://github.com/ConduitPlatform/Conduit/commit/15572e5f80327fd10755d6841d2d653f44e0dbfb))
* **cms:** query must be body parameter. ([cf01dac](https://github.com/ConduitPlatform/Conduit/commit/cf01dac6db69d7c74836eb09ca4cdf6d18e27b51))
* **cms:** rename the endpoint ([52624e6](https://github.com/ConduitPlatform/Conduit/commit/52624e6e7c5d4b882599a8b8a503159fc8056eaf))
* **cms:** return types ([e85ccdf](https://github.com/ConduitPlatform/Conduit/commit/e85ccdfdc39a77d95828a81f89b5e6fae5e3ca29))
* **cms:** schema controller query ([11788bb](https://github.com/ConduitPlatform/Conduit/commit/11788bb928d917c95332d57866389f24bcbdbd56))
* **cms:** schemaDefinitions migration ([5c98033](https://github.com/ConduitPlatform/Conduit/commit/5c980336d8cf54cfb98871922b328e0fe871d55e))
* **cms:** schemaDefinitions migration missing try catch ([159057f](https://github.com/ConduitPlatform/Conduit/commit/159057fb6f32c0e5f3544380a52952c16b7d0f35))
* **cms:** spacing ([91df34a](https://github.com/ConduitPlatform/Conduit/commit/91df34acdb7f84f9fb81a7492389d08fc74eceb2))
* **cms:** throw error when a field does not exist when editting documents. ([693182a](https://github.com/ConduitPlatform/Conduit/commit/693182aa31f2ecd2fcd9e20304499658726ff7a1))
* **cms:** toggleSchema, toggleSchemas handlers ([a14c79c](https://github.com/ConduitPlatform/Conduit/commit/a14c79c1539d9689722e8a50cf4fd5e0fa5a9bdd))
* **config:** fix return case ([da88d0f](https://github.com/ConduitPlatform/Conduit/commit/da88d0f9e39553ba371d9dc0331bedb6717eda49))
* **config:** PUT returning empty config for some modules ([e6d02a4](https://github.com/ConduitPlatform/Conduit/commit/e6d02a4c81aa66c6c98f062a05b886fe11fa7ba6))
* **config:** wrong error response on config PUT for active=false ([14e56a0](https://github.com/ConduitPlatform/Conduit/commit/14e56a0aa9914d4877f3afe39cfdc198a2880afd))
* **database-provider:** database-provider module renamed to 'database_provider' ([c016bdf](https://github.com/ConduitPlatform/Conduit/commit/c016bdf2abb5542f2b5b017151ccd9ab087f6e99))
* **database-provider:** remove botched findmany query in database save ([#20](https://github.com/ConduitPlatform/Conduit/issues/20)) ([7ee7ae1](https://github.com/ConduitPlatform/Conduit/commit/7ee7ae182d89632d4139cb5f7384749396d31c22))
* **database,cms:** migrations [Guided Migration] ([5ec7ac7](https://github.com/ConduitPlatform/Conduit/commit/5ec7ac7333762c2ec97c57cc1939c3be5e806bb1))
* **database,cms:** requested changes in permissions ([f2d0371](https://github.com/ConduitPlatform/Conduit/commit/f2d0371c6cf6a35a8b56023763e6a34e06a115be))
* **database:** createSchemaFromAdapter set modelOwner using grpc call's 'module-name' metadata ([be350ac](https://github.com/ConduitPlatform/Conduit/commit/be350acc1257a4663a80fd38470e2307f019fb8c))
* **database:** database was talking to itself ([bb29a9e](https://github.com/ConduitPlatform/Conduit/commit/bb29a9e3096cd35097aa9b5a8939003b1d585f23))
* **database:** DeclaredSchema class missing modelOptions field ([6e047dc](https://github.com/ConduitPlatform/Conduit/commit/6e047dc2049f6f53cf758d91bc85fc1df5b79001))
* **database:** DeclaredSchema.schema.ts name var ([e58d533](https://github.com/ConduitPlatform/Conduit/commit/e58d533275e8f3bf71912dae6021206877e6c395))
* **database:** extensions contained "type" ([f4baf08](https://github.com/ConduitPlatform/Conduit/commit/f4baf08d3584044451f4aef76d70f80c9209c0a1))
* **database:** non-stringified queries in getDeclaredSchemas, getDeclaredSchemasExtensions ([#24](https://github.com/ConduitPlatform/Conduit/issues/24)) ([89a1a66](https://github.com/ConduitPlatform/Conduit/commit/89a1a6684f44ced288ca17bd7e2abbf654a05763))
* **database:** rename DeclaredSchema back to _DeclaredSchema ([6fe6fb7](https://github.com/ConduitPlatform/Conduit/commit/6fe6fb7d6778797c40411d12144743f6ea4ab0c2))
* **database:** rename getDeclaredSchemaExtensions to getDeclaredSchemasExtensions ([e714018](https://github.com/ConduitPlatform/Conduit/commit/e71401805ca5521fa6d0ade66ebf3d594da6ddbd))
* dockerfile package names ([080a4ff](https://github.com/ConduitPlatform/Conduit/commit/080a4ff477e5ba5c79708a6afae0c87d51ea9ade))
* **email:** ConduitActiveSchema externalId field typo ([36ef4ae](https://github.com/ConduitPlatform/Conduit/commit/36ef4ae0df6e669ebb0ef502aab90df60fd1b22d))
* **email:** emails were not sent properly ([#540](https://github.com/ConduitPlatform/Conduit/issues/540)) ([bebc39a](https://github.com/ConduitPlatform/Conduit/commit/bebc39ab43ee5b92e3723bf301b075909e34fb1d))
* **github:** payments provider deployment ([95b21ce](https://github.com/ConduitPlatform/Conduit/commit/95b21ce7f4a4737d5cf2979cfb1e5efa3a09d27d))
* **grpc-sdk,commons,database,cms:** modelOptions conflict between ConduitSchema and SchemaDefinitions (ConduitSchema.modelOptions -> ConduitSchema.schemaOptions) ([e7a9381](https://github.com/ConduitPlatform/Conduit/commit/e7a93816b5ec7926ad3db3dfe142b556021a6c36))
* **grpc-sdk,commons,database:** optimize permission checks ([1bece2f](https://github.com/ConduitPlatform/Conduit/commit/1bece2f4eadd357a74dd57ab608bdb0af21deed1))
* **grpc-sdk:** explicitly rename auto-converted grpc metadata field moduleName to module-name ([d6c6d62](https://github.com/ConduitPlatform/Conduit/commit/d6c6d6267b2286b362649c3894a1172c9e671277))
* **grpc-sdk:** modulename injection to modules ([a937344](https://github.com/ConduitPlatform/Conduit/commit/a937344126f9ef416e2ad9132ae4a5db1919ea6e))
* **grpc-sdk:** remove readonly flag from ConduitSchema.modelOptions (CMS.editSchema requirement) ([5d85baa](https://github.com/ConduitPlatform/Conduit/commit/5d85baa71debea950bb5e7373abf7d934a4f1dc0))
* **grpc-sdk:** routing manager middleware parsing ([83e261a](https://github.com/ConduitPlatform/Conduit/commit/83e261a41f061467ddceb19da7ff3e77d82979c4))
* **payments:** editProduct route's optional stripe.subscriptionId being required ([306aee9](https://github.com/ConduitPlatform/Conduit/commit/306aee93bb20f045b079390dcf8a6ab39ebe0396))
* **payments:** stripe object must contains only customerId ([703b064](https://github.com/ConduitPlatform/Conduit/commit/703b0640d39673b061577a729404b538f587a2ec))
* **pushNotifications:** Prevent firebase app from initializing more than one time ([a971a0a](https://github.com/ConduitPlatform/Conduit/commit/a971a0a363ddb065b99d6f3f029ba654283798a4))
* **router,admin:** route or getting registered routes moved to router package [#1](https://github.com/ConduitPlatform/Conduit/issues/1)jtc9dd ([3cdf4e7](https://github.com/ConduitPlatform/Conduit/commit/3cdf4e729b08d4d7a9ea7fa57497134402f23b2c)), closes [#1jtc9](https://github.com/ConduitPlatform/Conduit/issues/1jtc9)
* **router:** GraphQlParser constructName() ([51813a2](https://github.com/ConduitPlatform/Conduit/commit/51813a222fde37d1fba4c017256e04d795295aaa))
* **router:** GraphQlParser typeString formatting ([bef87ed](https://github.com/ConduitPlatform/Conduit/commit/bef87ed6af98d2b1b65cdc59bd8eb4b32cbfdeeb))
* **router:** GraphQlParser.getResultFromObject() call to constructorResolver() ([c5e8747](https://github.com/ConduitPlatform/Conduit/commit/c5e8747821084a521f7e8a2bce7b08cc6ccda820))
* **router:** swagger parser params ([6af9c73](https://github.com/ConduitPlatform/Conduit/commit/6af9c73f5d37be9f69450e367c2a8c187c05256f))
* **router:** swagger parsing (up to a point) ([7b507d6](https://github.com/ConduitPlatform/Conduit/commit/7b507d69d24a3edfb0c706f1451ea6534270fa39))
* **security:** GetSecurityClient route requiring a urlParam id ([34005b0](https://github.com/ConduitPlatform/Conduit/commit/34005b0a8712a1797e13855c9d530c6a7f115255))
* SERVICE_URL rename to SERVICE_IP in all env variables ([0fcb08a](https://github.com/ConduitPlatform/Conduit/commit/0fcb08aa7d9a42f94aa3d4d5e4f63363e9332f38))
* **sms:** send sms naming when register the route ([#542](https://github.com/ConduitPlatform/Conduit/issues/542)) ([eda7ad1](https://github.com/ConduitPlatform/Conduit/commit/eda7ad18dbabba6f3bc924129a1f4c582694297e))
* **storage:** checking for active container ([fe92abb](https://github.com/ConduitPlatform/Conduit/commit/fe92abb5e547562af5f0196ad0e9d5b4918dcb1c))
* **storage:** checking for Nil at createFile() ([15fa78c](https://github.com/ConduitPlatform/Conduit/commit/15fa78cbcbcb0426873355c024cde44eb818ae30))
* **storage:** delete logs ([977e7fe](https://github.com/ConduitPlatform/Conduit/commit/977e7fe40bff1b8709778c1f8a7e02642c0b5acb))
* **storage:** migrate non admin routes ([7e2291c](https://github.com/ConduitPlatform/Conduit/commit/7e2291c57653f8079c5c1c93b09e8f68734f1955))
* **storage:** return types changed to File.getInstance().fields ([c9aebf4](https://github.com/ConduitPlatform/Conduit/commit/c9aebf44cc245a52b68cc4b289978d34db0ba62c))
* **storage:** using id to delete folder,container instead of using name and container ([e063c00](https://github.com/ConduitPlatform/Conduit/commit/e063c0072460efe70829f3dc1cef1007089c8435))
* upgrade @grpc/grpc-js from 1.4.3 to 1.5.0 ([#10](https://github.com/ConduitPlatform/Conduit/issues/10)) ([a98d078](https://github.com/ConduitPlatform/Conduit/commit/a98d0786312c6db036f0b675f5c19d667c6354db))
* upgrade @grpc/grpc-js from 1.5.0 to 1.5.1 ([#16](https://github.com/ConduitPlatform/Conduit/issues/16)) ([c138378](https://github.com/ConduitPlatform/Conduit/commit/c1383781919236dc638c33982c55a2bb852f4f42))
* upgrade @grpc/grpc-js from 1.5.1 to 1.5.2 ([#27](https://github.com/ConduitPlatform/Conduit/issues/27)) ([f293e04](https://github.com/ConduitPlatform/Conduit/commit/f293e041bdd11b92ae2a7b68074f38b93232ff1e))
* upgrade @grpc/grpc-js from 1.5.2 to 1.5.3 ([#28](https://github.com/ConduitPlatform/Conduit/issues/28)) ([ec18e05](https://github.com/ConduitPlatform/Conduit/commit/ec18e05b35397e8828b5e4c38a198a104086e1c0))
* upgrade @grpc/proto-loader from 0.5.4 to 0.6.9 ([#5](https://github.com/ConduitPlatform/Conduit/issues/5)) ([463e600](https://github.com/ConduitPlatform/Conduit/commit/463e600de810ecd09f0e9aad23c2987bf3eeab77))
* upgrade @types/google-protobuf from 3.7.2 to 3.15.5 ([#7](https://github.com/ConduitPlatform/Conduit/issues/7)) ([a0173c9](https://github.com/ConduitPlatform/Conduit/commit/a0173c9f7d469e7a521138dc8c959fa2b66db175))
* upgrade @types/ioredis from 4.28.1 to 4.28.7 ([#9](https://github.com/ConduitPlatform/Conduit/issues/9)) ([6652d03](https://github.com/ConduitPlatform/Conduit/commit/6652d0318cc7705e7fac6a74f1c4aee16237a347))
* upgrade @types/lodash from 4.14.150 to 4.14.178 ([#6](https://github.com/ConduitPlatform/Conduit/issues/6)) ([14406bd](https://github.com/ConduitPlatform/Conduit/commit/14406bd1faa6e6ea9ba783049f3aa94b5b117afa))
* upgrade ioredis from 4.28.0 to 4.28.3 ([#11](https://github.com/ConduitPlatform/Conduit/issues/11)) ([ceec73c](https://github.com/ConduitPlatform/Conduit/commit/ceec73cff29beb488e0afd5e9a286ea7fc662003))
* upgrade lodash from 4.17.15 to 4.17.21 ([#8](https://github.com/ConduitPlatform/Conduit/issues/8)) ([ad8239f](https://github.com/ConduitPlatform/Conduit/commit/ad8239f3def9ee7432367c2b0c988d6f38a1683a))


* Generate form submission routes based on form id #225fw4q, refactor user routes async #1y7np0w (#532) ([c287065](https://github.com/ConduitPlatform/Conduit/commit/c287065a5d6e1cac087a5c08ef6b2d0c0e439c57)), closes [#225fw4](https://github.com/ConduitPlatform/Conduit/issues/225fw4) [#1y7np0](https://github.com/ConduitPlatform/Conduit/issues/1y7np0) [#532](https://github.com/ConduitPlatform/Conduit/issues/532)
* Route consistency changes #1vx9zpy (#518) ([aa1c8ab](https://github.com/ConduitPlatform/Conduit/commit/aa1c8ab42200afe61dbe7b6d2429c4260297bf2e)), closes [#1vx9](https://github.com/ConduitPlatform/Conduit/issues/1vx9) [#518](https://github.com/ConduitPlatform/Conduit/issues/518)
* **cms,sms,push-notifications,authentication:** {message} routes now return a String type ([dbd2f2f](https://github.com/ConduitPlatform/Conduit/commit/dbd2f2f92d86e9ec621f149e29998b6ca7bb4157))
* **cms:** unnest getSchemas return fields from 'results' ([9001254](https://github.com/ConduitPlatform/Conduit/commit/90012546eaabf4270e7b11ab88b000c45a081fd1))
* **cms:** user routes async [#1](https://github.com/ConduitPlatform/Conduit/issues/1)y7np0w ([#535](https://github.com/ConduitPlatform/Conduit/issues/535)) ([c8e3ad0](https://github.com/ConduitPlatform/Conduit/commit/c8e3ad0bf894e6f2dc407388450ce7693cc58dd9)), closes [#1y7np0](https://github.com/ConduitPlatform/Conduit/issues/1y7np0)
* **config:** convert admin routes to ConduitRoutes ([b0cf6cc](https://github.com/ConduitPlatform/Conduit/commit/b0cf6ccdc158b796855fb93b3ec2f7d0f1a3a371))
* **database:** renamed database-provider module to 'database' ([1a4d1b6](https://github.com/ConduitPlatform/Conduit/commit/1a4d1b6f19d4659d9b30ce8bf746012eba6fef78))
* **security:** convert admin routes to ConduitRoutes ([f1c61d4](https://github.com/ConduitPlatform/Conduit/commit/f1c61d4daf219cf35cafcc137e8a3635542bcb98))

### [0.10.6](https://github.com/ConduitPlatform/Conduit/compare/v0.10.5...v0.10.6) (2021-12-06)


### Features

* **chat:** populate added at getMessages also. [#1](https://github.com/ConduitPlatform/Conduit/issues/1)td8cvz ([e63630c](https://github.com/ConduitPlatform/Conduit/commit/e63630c7a594cd7d1ae883920bb69b8d4f7d8c96)), closes [#1td8](https://github.com/ConduitPlatform/Conduit/issues/1td8)
* **database:** drop collection of custom schemas [#1](https://github.com/ConduitPlatform/Conduit/issues/1)u9r11e ([3944e77](https://github.com/ConduitPlatform/Conduit/commit/3944e77726f069c760dbdc39b0ab6843a4f779f7)), closes [#1u9r11](https://github.com/ConduitPlatform/Conduit/issues/1u9r11)


### Bug Fixes
* **security:** secret migration not using the proper regex ([c05843d7](https://github.com/ConduitPlatform/Conduit/pull/486/commits/c05843d761b8abcdf81f7e4de48bb309feb86df8))
* **grpc-sdk:** chat not exporting send message ([7a80040](https://github.com/ConduitPlatform/Conduit/commit/7a80040945698e639c10382e006eef044ee44916))
* **authentication:** searching with id now is supported ([c03fe4c](https://github.com/ConduitPlatform/Conduit/commit/c03fe4c06218c69f52153d11c09808f0ee7922ef))
* **auth:** was searching by wrong field. ([512259a](https://github.com/ConduitPlatform/Conduit/commit/512259a05611b2c6960a34981c5f23be0c63aafc))
* **build-errors:** fixed 3 build errors ([7cb467f](https://github.com/ConduitPlatform/Conduit/commit/7cb467fad68dc229e2281b3e0f687e4e8e629cdf))
* change layout label prop signature to only accept objects ([4613fac](https://github.com/ConduitPlatform/Conduit/commit/4613fac1789ad428e254391b1dfb6f2489a8d1e6))
* **chat:** constant rename ([0425019](https://github.com/ConduitPlatform/Conduit/commit/0425019980bf3302c6e21ddcb2c09f56fc1acd51))
* **chat:** folderName handling ([f52d674](https://github.com/ConduitPlatform/Conduit/commit/f52d674ed316d33f910a2789c8d3cbb1839fc113))
* **chatimplementation-of-select:** fixed to properly work with the new way of receiving details ([8e4357b](https://github.com/ConduitPlatform/Conduit/commit/8e4357bba87d7a0b1db7958c4276338c1f084f74))
* **chat:** invalid value of totalCount while using search variable [#1](https://github.com/ConduitPlatform/Conduit/issues/1)tjtwht ([cbd60c8](https://github.com/ConduitPlatform/Conduit/commit/cbd60c8575ddf3618eb6274101ca644264d7c948))
* **chat:** missing comment ([213e194](https://github.com/ConduitPlatform/Conduit/commit/213e19420d561322b7691f4de01e6dde7c6f8dec))
* **chat:** reset chat panel data when navigating ([c84d2b3](https://github.com/ConduitPlatform/Conduit/commit/c84d2b339ba54096e972b96cdce82ced130d02ee))
* **ChatRoomTabs:** removed redundant return statement ([287b430](https://github.com/ConduitPlatform/Conduit/commit/287b430c20f277643037faed5d38f951b5ffa988))
* **chat:** search ([827b763](https://github.com/ConduitPlatform/Conduit/commit/827b763194429005af60d2ffe40a54f867330f6e))
* **chat:** sonar cloud fixes ([fbecb11](https://github.com/ConduitPlatform/Conduit/commit/fbecb111bfa14f22266d8665482ea36069781245))
* **chat:** tab styling ([d5d80d9](https://github.com/ConduitPlatform/Conduit/commit/d5d80d9fcef19213f6e4516df82636e720f128f0))
* **cms:** prettier ([521c6a8](https://github.com/ConduitPlatform/Conduit/commit/521c6a837c93c80091502721cbeb28b72ec3a196))
* **codeSmell:** fixed requested codeSmell ([0e27641](https://github.com/ConduitPlatform/Conduit/commit/0e2764168da7042a72af3b5facc6040f41be8460))
* **config-hook-form:** added layout ([d882716](https://github.com/ConduitPlatform/Conduit/commit/d882716e22c999fe652ef5752196089a21fe1289))
* **config:** await was missing when a setConfig function was being  called. ([15f3ef6](https://github.com/ConduitPlatform/Conduit/commit/15f3ef60071b4db3be5ad2936ff833ee69912475))
* **conflicts:** & Merge branch 'master' of https://github.com/ConduitPlatform/Conduit into drawer-wrapper-refactor ([3d7edd4](https://github.com/ConduitPlatform/Conduit/commit/3d7edd4f7533b1a0e815a466c72abea0148e0677))
* **core:** package naming to match other packages ([1daf102](https://github.com/ConduitPlatform/Conduit/commit/1daf1026cdf95a94aea8b602f711859c152c3ac0))
* **create&editform:** correct regexp to dissallow spaces on form name ([16c710e](https://github.com/ConduitPlatform/Conduit/commit/16c710e8416f3432e7a0994ac5a24adb3b9baca8))
* **customerForm:** display user email/name instead of _id ([970283a](https://github.com/ConduitPlatform/Conduit/commit/970283a82479aeca0cd8d72f46c339ab98118ba2))
* **customerForm:** implementation of singleSelect on customerForm ([1f55ed5](https://github.com/ConduitPlatform/Conduit/commit/1f55ed540f4fa4e36a8be63ad112245731d499bf))
* **data-table-sorting:** no labels when sorting === false && fixed sorting ([7a5f922](https://github.com/ConduitPlatform/Conduit/commit/7a5f92274afe3e6e2bd3374e5be506a0ba071860))
* **database:** bump mongoose to 5.13.13 to fix package vulnerabilities ([04fb96b](https://github.com/ConduitPlatform/Conduit/commit/04fb96b551d26562dc9cf42a0fc598ca62161e36))
* **database:** deleteSchema() converted to async ([913c148](https://github.com/ConduitPlatform/Conduit/commit/913c148d61af02cf8e3ceabea9f006f3ea213ea6))
* **database:** schema also deleted from declaredSchemas ([483baa9](https://github.com/ConduitPlatform/Conduit/commit/483baa904d236cef67bc75be491b2ec2043a8323))
* **dataTable:** remove useState ([c449a6c](https://github.com/ConduitPlatform/Conduit/commit/c449a6c1a7dae198c8395519bba5d5f94b37b315))
* **dataTableSize:** default to denser tables ([d19c1cc](https://github.com/ConduitPlatform/Conduit/commit/d19c1ccc7ad40ce639583c7ab664e4ce29611a3d))
* **dataTable:** unused imports and self closing table cell ([61ef4e3](https://github.com/ConduitPlatform/Conduit/commit/61ef4e3d1c867f4ba2c9ad20e5e9d8de09edfb46))
* **dockerfiles:** build process for core and admin ([955f8ef](https://github.com/ConduitPlatform/Conduit/commit/955f8eff4e8548b428a960767fa4e8b99cf191f6))
* **drawer-buttons:** placed correctly ([4442a20](https://github.com/ConduitPlatform/Conduit/commit/4442a2001446ca39bcb95d0020db43a03c1de320))
* **drawers:** add a persistent title for consistency ([86dfa66](https://github.com/ConduitPlatform/Conduit/commit/86dfa66210f8fa33f8f4a48bf67a27af3e5311b2))
* **editForm:** fixes sonarclound duplicate import ([4d7c549](https://github.com/ConduitPlatform/Conduit/commit/4d7c549c6926ce6c3572c645a86443184edf4e8e))
* **email:** Dockerfile ([7d67c59](https://github.com/ConduitPlatform/Conduit/commit/7d67c598fc2158c53d620df4f7181c09fcd2af92))
* **emails:** compose email variables, proper tabs, external template body on editor ([a8221cc](https://github.com/ConduitPlatform/Conduit/commit/a8221cc71f9c989a19fee811ee3f7b42dfc94e6e))
* **email:** searching with id now is supported ([db58053](https://github.com/ConduitPlatform/Conduit/commit/db580536a9d4c616ef63f770aa3e03a76dcb323d))
* **emailsettings:** proper name ([2b103f2](https://github.com/ConduitPlatform/Conduit/commit/2b103f2608fac0c4206cc571a3a00d7010f97bda))
* **email:** totalCount return value fixed. ([b12b3a2](https://github.com/ConduitPlatform/Conduit/commit/b12b3a201521aa274829e2ac8ee284ca610c6159))
* **endpointNames:** proper enpoint names without hyphen ([fdd8cc1](https://github.com/ConduitPlatform/Conduit/commit/fdd8cc1663e321dcb0264d372693b74b96dab705))
* **FormInputText:** redundant boolean ([136e067](https://github.com/ConduitPlatform/Conduit/commit/136e067971b6f07a366f5ddf7e10461addada627))
* **github:** builds running on PRs ([c5b6f16](https://github.com/ConduitPlatform/Conduit/commit/c5b6f16dc88be6c73f15d5ab9d7e8980d5306504))
* **github:** remove document action from build ymls ([678765a](https://github.com/ConduitPlatform/Conduit/commit/678765a80a6d6c2027500a26b6a54caeb5b39b70))
* **httpModels:** made a new folder and moved typically used types for requests ([841b62b](https://github.com/ConduitPlatform/Conduit/commit/841b62b98433e532966885502ef2b36db99952f1))
* **imports:** some unused imports ([b18cb58](https://github.com/ConduitPlatform/Conduit/commit/b18cb581c292ff253d2aed4994b2849cbbffbc9b))
* **indeterminate&layout:** indeterminate deselected after deletion and better names on the layout ([13a910a](https://github.com/ConduitPlatform/Conduit/commit/13a910acb7921b366da1dbbe73d06cf711bc8958))
* inner layout router function ([33995dd](https://github.com/ConduitPlatform/Conduit/commit/33995dde8d3866ccf61b0f06295160a584eebac3))
* layout styling ([4e9d0af](https://github.com/ConduitPlatform/Conduit/commit/4e9d0afab10554b654187c334070027508a5d379))
* **makefile:** missing space ([9dbd3ac](https://github.com/ConduitPlatform/Conduit/commit/9dbd3ac6be7d2ec651cb37a60f4e0171ec7b97ec))
* **makefile:** storage and email builds ([4630d48](https://github.com/ConduitPlatform/Conduit/commit/4630d4888014d93654248651a29fd9ffcbc5afca))
* **nextJsImporterror:** used eslint rule to avoid unwanted behaviour ([dd779ef](https://github.com/ConduitPlatform/Conduit/commit/dd779ef2c4bc0a2942e93d14063600ab3c764b63))
* **notificationSettings&send:** Proper configuration ([a0ff02f](https://github.com/ConduitPlatform/Conduit/commit/a0ff02f09f3b552bd0dd157d84b208b16986b71b))
* **notificationSettings:** now we properly get the settings data ([46c991e](https://github.com/ConduitPlatform/Conduit/commit/46c991efd1158b7c860785b0a95af7df4f6f8619))
* **notificationSettings:** types where needed ([b3b112d](https://github.com/ConduitPlatform/Conduit/commit/b3b112d79c1bfcd10fdb715bc9e1883f354b9b85))
* **notifications:** fix requested types ([d18b0dd](https://github.com/ConduitPlatform/Conduit/commit/d18b0dd589299c89545401b3240e248594c517f2))
* **payment-settings&swagger:** proper edit and link ([228562d](https://github.com/ConduitPlatform/Conduit/commit/228562d50af9387aec57b539b37a8974b3441701))
* **paymentforms:** fix code smells ([676f2c3](https://github.com/ConduitPlatform/Conduit/commit/676f2c358a7273bf0171ba494a34f8571572ff7b))
* **paymentForms:** fix merge conflicts & Merge branch 'master' of https://github.com/ConduitPlatform/Conduit into rhf-payments ([037cf92](https://github.com/ConduitPlatform/Conduit/commit/037cf92722716f56b13af4e7ae2e12b6a0dc3add))
* **paymentForms:** fix requested changes, types ([9bb536e](https://github.com/ConduitPlatform/Conduit/commit/9bb536ed7b9ba3dc151d03c515a333164e7ec1f3))
* **push-notifications:** missing comment ([1f0b451](https://github.com/ConduitPlatform/Conduit/commit/1f0b4518e65079c60ffbd4cfb6ff7feb634366a4))
* **react-hook-form:** Added rhf to storage settings ([24a52b3](https://github.com/ConduitPlatform/Conduit/commit/24a52b36c1364682782c5d789cfe262892d8cfd9))
* **remove-log:** removed console log ([daf181e](https://github.com/ConduitPlatform/Conduit/commit/daf181e3f9279c3aae986e0a2367427b55b2a4f4))
* **requests-config:** removed unnecessary check ([246f257](https://github.com/ConduitPlatform/Conduit/commit/246f257226852e8e41f3e59db5f3704affab3400))
* reset table data when navigating ([8d2a543](https://github.com/ConduitPlatform/Conduit/commit/8d2a543681c5bd980df8a3e262b2faefe5e4649e))
* **rhfForms:** required changes ([872511d](https://github.com/ConduitPlatform/Conduit/commit/872511dfdc8accef851d5d774a0265fb0ee1fccf))
* **sanitization:** moved sanitize on request interceptors ([54e8e7c](https://github.com/ConduitPlatform/Conduit/commit/54e8e7ca3e95df37020776c51fed1901a1952626))
* **sanitizeParams:** param sanitization on most tables & added types for common cases like pagination ([c45be26](https://github.com/ConduitPlatform/Conduit/commit/c45be268c7904080339510f910bf5d9080a97895))
* **sanitize:** proper types for pagination ([d8fec7e](https://github.com/ConduitPlatform/Conduit/commit/d8fec7ed9d26366d36bd3f3789d40d0eaa1530ba))
* **schemas-table:** proper way to handle visible-data ([f663178](https://github.com/ConduitPlatform/Conduit/commit/f6631782d1fe5d00d48478cdbe7e303485071b2b))
* **schemas:** multiple selection works properly ([e121944](https://github.com/ConduitPlatform/Conduit/commit/e121944dead900740a2292b2c434a16a93e61a47))
* **schemas:** null check to visible schemas ([1cc7884](https://github.com/ConduitPlatform/Conduit/commit/1cc7884442ea25dbd86f7cc94e033d13d1b4f28c))
* **selectable-elements-table:** we can now retrieve every value the table has, not only the _id ([3a6f4d9](https://github.com/ConduitPlatform/Conduit/commit/3a6f4d9432b35dcce2e43eec87d5496b40f0d192))
* **selected-elements:** now we show any kind of info we want like name, email etc ([4e9d4ef](https://github.com/ConduitPlatform/Conduit/commit/4e9d4eff746ad719373decbc446f945ecd32ed0b))
* **sendEmailForm:** fixed an empty expression ([39a580c](https://github.com/ConduitPlatform/Conduit/commit/39a580c1864f3194ae050c1802ba22bee3c257a4))
* **sendEmailForm:** fixed sonarcloud issue ([20c9110](https://github.com/ConduitPlatform/Conduit/commit/20c9110928317cea52fe0457c454f155ebd924e7))
* **showDrawerData:** remove __v and format dates ([69dc250](https://github.com/ConduitPlatform/Conduit/commit/69dc2502d2476800873330b6409b8c84c25571d4))
* **single-selection:** added prop for single selection ([093b178](https://github.com/ConduitPlatform/Conduit/commit/093b17826d933219df215a9d7c19e25b6f3ba988))
* **sonar-cloud-bug:** turned while iteration to if ([e2958eb](https://github.com/ConduitPlatform/Conduit/commit/e2958eb2f52c1005fc9e4c19f10472f4d627f65a))
* **sonar-cloud-smells:** unused imports ([9173274](https://github.com/ConduitPlatform/Conduit/commit/9173274be30946cee8c96941271de96727a87fc0))
* **storage settings switch:** added state to the switch to change accordingly ([a17c2cc](https://github.com/ConduitPlatform/Conduit/commit/a17c2ccc86020975a1cc22066e52a66cbecd35da))
* **storage-settings:** proper handling of the config ([7afd455](https://github.com/ConduitPlatform/Conduit/commit/7afd4552435ea76b6b051418b24c0e94cd815065))
* **storage-settings:** removed not needed file ([7eaea17](https://github.com/ConduitPlatform/Conduit/commit/7eaea17c76ef85f79af599d79bbc615e10156ca4))
* **storage-settings:** requested changes ([f42cb7d](https://github.com/ConduitPlatform/Conduit/commit/f42cb7d596970f550a92d85e374bad36708c4b92))
* **storage-settings:** styling fixes ([53454e7](https://github.com/ConduitPlatform/Conduit/commit/53454e7ce3692214cf1303fb34893aec1af67666))
* **storage:** "/" character not clickable on path ([d3275ca](https://github.com/ConduitPlatform/Conduit/commit/d3275ca94111e92ba247ce725ee72e70c088829f))
* **storage:** current container no longer empty as default value ([66dc142](https://github.com/ConduitPlatform/Conduit/commit/66dc142fc44b0e934fe1920b631bb7896f0a840e))
* **storage:** get folder param name fix ([ca4e77c](https://github.com/ConduitPlatform/Conduit/commit/ca4e77cc5f39c5820fc4368efeefa7140e007d5e))
* **storage:** handle folder name when creating new one ([aa29899](https://github.com/ConduitPlatform/Conduit/commit/aa29899ad99a43a49dcb2eae7d6849e8123b6122))
* **storage:** regex fixed for finding child folders at getFolders() ([b42b5a9](https://github.com/ConduitPlatform/Conduit/commit/b42b5a9eadfe8a6369e64020a6ccd3d4ec1a3945))
* **storage:** remove redundant return ([487a8d9](https://github.com/ConduitPlatform/Conduit/commit/487a8d93c5cf6718881e59eab568e001ec62da22))
* **storage:** update data when deleting container/folder/file ([67a8729](https://github.com/ConduitPlatform/Conduit/commit/67a87292325d7bcc19ff60193c588a9a5db7f5e6))
* **swaggerlink:** swagger redirects to forms now ([af86b39](https://github.com/ConduitPlatform/Conduit/commit/af86b394fb7c048b7a1fdb6c4122a1f18c9be6dc))
* **swagger:** proper notifications swagger ([2ce7907](https://github.com/ConduitPlatform/Conduit/commit/2ce79079a1016ac2d8757f59861505e0efbe2ecc))
* **table-density:** option to change density & clearer imports on dataTable ([1f5738c](https://github.com/ConduitPlatform/Conduit/commit/1f5738ccfa59594fea2a9f7037c40e8ab3ea6c90))
* **tablesSearch:** properly reset page when searching/filtering ([76287dd](https://github.com/ConduitPlatform/Conduit/commit/76287dd384a5ce22cf50d9980cb30e2160ef3f31))

### [0.10.5](https://github.com/ConduitPlatform/Conduit/compare/v0.10.4...v0.10.5) (2021-11-16)


### ⚠ BREAKING CHANGES

* client secrets are now encrypted in the DB

### Features

* **cms:** implement deleteManySchemas(), toggleMany() ([904aa38](https://github.com/ConduitPlatform/Conduit/commit/904aa38e7241b1ed0a04d23513d6f3571735167d))
* **database:** findByIdAndUpdate() populate param ([f383997](https://github.com/ConduitPlatform/Conduit/commit/f38399789796b6f941b486408325c9feed7506a1))
* **database:** populate support at sequalizeSchema at findByIdAndUpdate ([b3a1574](https://github.com/ConduitPlatform/Conduit/commit/b3a1574724c008b3c5045a5cac1dfa71c420b2f3))


### Bug Fixes

* **authentication:** getUsers search variable ([32c04d1](https://github.com/ConduitPlatform/Conduit/commit/32c04d1d2cf559e0967b7516d5877fcb7e1d464a))
* **authentication:** minor fix ([b621afd](https://github.com/ConduitPlatform/Conduit/commit/b621afd7b2476f3ea9aa24e90b75793350cfdac4))
* **authentication:** package.json update ([6604057](https://github.com/ConduitPlatform/Conduit/commit/6604057fd1563e331e654405c87eddb405f4ec1f))
* **chat:** logs ([54d2ce3](https://github.com/ConduitPlatform/Conduit/commit/54d2ce3ca5e05db8bed01ef2f91f0cfa7388c389))
* **chat:** ret value changed at delete operations ([45e106b](https://github.com/ConduitPlatform/Conduit/commit/45e106b89358cda68df797da6c7d908a1cbe4ba2))
* **database:** minor fix ([2074352](https://github.com/ConduitPlatform/Conduit/commit/2074352d0997401b2dd35593be0a5f8de6792d4f))
* **database:** populate type ([74bdd05](https://github.com/ConduitPlatform/Conduit/commit/74bdd05e6f728875f35ae612b0f4ac82dffc366f))
* **database:** populate variable checking ([ab59d0a](https://github.com/ConduitPlatform/Conduit/commit/ab59d0a932334a12173c507cc0f6febb7a273d1c))
* **forms:** createForm() and editFormById() not accepting Date and Number fields, triple-stash html data values in FormSubmissionTemplate ([8c0ee28](https://github.com/ConduitPlatform/Conduit/commit/8c0ee28fb8a56148ed6f29f36e0dee613b63973f))
* **github:** missing email provider dependency in email module action ([904442e](https://github.com/ConduitPlatform/Conduit/commit/904442e6d45778097749aba358e082678e04c385))
* **pushNotifications:** delete logs ([5a32571](https://github.com/ConduitPlatform/Conduit/commit/5a32571533e3675b736cf7e5a47900d82334ea71))
* **pushNotifications:** name of  module changed ([8b74967](https://github.com/ConduitPlatform/Conduit/commit/8b7496719d9f7bb00897bdc27b5e29abad0bc82a))
* **pushNotifications:** name of  module changed ([ab054ff](https://github.com/ConduitPlatform/Conduit/commit/ab054ff3cc9e0da8f1cfaf85e0e47c414107c00a))
* **pushNotifications:** name of  module changed ([34156bc](https://github.com/ConduitPlatform/Conduit/commit/34156bcf05ea2ab683751fc67dd79e027a95c1d1))
* **storage:** checking for '/' existance [#1](https://github.com/ConduitPlatform/Conduit/issues/1)p68x6j ([119325b](https://github.com/ConduitPlatform/Conduit/commit/119325b2952e353503a3e900784a97b568e56c1d)), closes [#1p68x6](https://github.com/ConduitPlatform/Conduit/issues/1p68x6)
* **storage:** checking for '/' existance in deleteFolder(),getFiles() [#1](https://github.com/ConduitPlatform/Conduit/issues/1)p68x6j ([5024ce5](https://github.com/ConduitPlatform/Conduit/commit/5024ce5c05ecc7de1687f3f1c3ce364f12b6c623)), closes [#1p68x6](https://github.com/ConduitPlatform/Conduit/issues/1p68x6)


* refactor!(security):  encrypt client secrets ([a00e9e5](https://github.com/ConduitPlatform/Conduit/commit/a00e9e52bb72804b1355dad460f7a7ef845e455e))
