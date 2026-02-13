# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.16.23](https://github.com/ConduitPlatform/Conduit/compare/v0.16.22...v0.16.23) (2026-02-13)


### Bug Fixes

* **grpc-sdk:** missing params in method signatures ([#1440](https://github.com/ConduitPlatform/Conduit/issues/1440)) ([ca2cf29](https://github.com/ConduitPlatform/Conduit/commit/ca2cf29a7c28536c61ab9dbcc1480ff511fd832b))

### [0.16.22](https://github.com/ConduitPlatform/Conduit/compare/v0.16.21...v0.16.22) (2026-02-12)


### Bug Fixes

* **chat:** missing join-room event for grpc room creations ([f31f449](https://github.com/ConduitPlatform/Conduit/commit/f31f449d8100762c80a3b988583706ba0efd01b5))
* **email:** empty subject in rpc was overriding template ([1048ac5](https://github.com/ConduitPlatform/Conduit/commit/1048ac5ecc93a92c9f25e9c4617ab5a2688b0f84))
* **hermes:** context data not being added to socket data ([4ef5dce](https://github.com/ConduitPlatform/Conduit/commit/4ef5dce0328dab1625bfe1bfe7213173995da002))
* **hermes:** namespace access on socket filtering using wrong operator ([c6a4ae0](https://github.com/ConduitPlatform/Conduit/commit/c6a4ae0473789872d92baa65e75b2cbead21354c))

### [0.16.21](https://github.com/ConduitPlatform/Conduit/compare/v0.16.20...v0.16.21) (2026-01-30)


### Features

* **storage:** change mechanics of public/private containers to be aligned with expectations ([#1414](https://github.com/ConduitPlatform/Conduit/issues/1414)) ([fae8a87](https://github.com/ConduitPlatform/Conduit/commit/fae8a8713a12e1109fb48cc50a94e620481cb241))


### Bug Fixes

* **chat:** make message not required to account for types that don't need it ([81b74fa](https://github.com/ConduitPlatform/Conduit/commit/81b74faaaafb516d836c914eba975cc214afb53d))
* **hermes:** wrong emition case & json parse error ([#1419](https://github.com/ConduitPlatform/Conduit/issues/1419)) ([2fe456a](https://github.com/ConduitPlatform/Conduit/commit/2fe456a803f149fcec6858ddd481e89d978594c3))

### [0.16.20](https://github.com/ConduitPlatform/Conduit/compare/v0.16.19...v0.16.20) (2025-11-21)


### Features

* **authentication:** delete invitation endpoint for teams ([1d6df18](https://github.com/ConduitPlatform/Conduit/commit/1d6df18e33705e88c9ca193ff116b54669e9440f))
* **chat:** add system enum and optional message type in grpc function ([#1403](https://github.com/ConduitPlatform/Conduit/issues/1403)) ([0c6eaaf](https://github.com/ConduitPlatform/Conduit/commit/0c6eaaf2e34fee57dff119f6d03baeb29421c0b5))
* **email:** send mail rpc was missing subject/body ([#1398](https://github.com/ConduitPlatform/Conduit/issues/1398)) ([9cccfa2](https://github.com/ConduitPlatform/Conduit/commit/9cccfa26b29e1c2e7bc4336fd0d5e66dd61c267e))
* get pending invites in team ([#1400](https://github.com/ConduitPlatform/Conduit/issues/1400)) ([a265a1b](https://github.com/ConduitPlatform/Conduit/commit/a265a1bb7ff7f4f38fe92bd3101abacd3e7ed397))

### [0.16.19](https://github.com/ConduitPlatform/Conduit/compare/v0.16.18...v0.16.19) (2025-10-09)


### Features

* **authentication:** update team RPC ([#1395](https://github.com/ConduitPlatform/Conduit/issues/1395)) ([ba8caac](https://github.com/ConduitPlatform/Conduit/commit/ba8caacb5367da1edc8d6bd8cd89f25f42398501))


### Bug Fixes

* **database:** aggregation pipeline spreading ([#1393](https://github.com/ConduitPlatform/Conduit/issues/1393)) ([365779e](https://github.com/ConduitPlatform/Conduit/commit/365779e0866fb57e10d5c40400eadec15f232c7a))
* rawQuery throwing error on mongoose update methods ([#1391](https://github.com/ConduitPlatform/Conduit/issues/1391)) ([8e5a316](https://github.com/ConduitPlatform/Conduit/commit/8e5a316121ae73798f3b0a1ea41042fe95241308))

### [0.16.18](https://github.com/ConduitPlatform/Conduit/compare/v0.16.17...v0.16.18) (2025-09-15)


### Features

* **authentication:** invite user to team RPC ([#1383](https://github.com/ConduitPlatform/Conduit/issues/1383)) ([47c42e7](https://github.com/ConduitPlatform/Conduit/commit/47c42e7c0dc45ead2088a783b916c3d8fbde5088))
* **email:** port email json template from v-next branch ([#1366](https://github.com/ConduitPlatform/Conduit/issues/1366)) ([da25dc1](https://github.com/ConduitPlatform/Conduit/commit/da25dc16ab1ca5a18607315152d61ddd5e39ed14))
* **hermes:** verbose logging in socket router to assist debugging ([1875ed7](https://github.com/ConduitPlatform/Conduit/commit/1875ed779dddd4fd645317a5fd562934fd707219))
* **storage:** support for proper disposition headers to maintain true filenames when using aliases ([#1358](https://github.com/ConduitPlatform/Conduit/issues/1358)) ([ffaab4e](https://github.com/ConduitPlatform/Conduit/commit/ffaab4e919b7de3bb647adf1dc904a95e69aa20c))


### Bug Fixes

* **authorization:** when providing relations that don't exist, the creation crashes ([#1370](https://github.com/ConduitPlatform/Conduit/issues/1370)) ([7f2f7d9](https://github.com/ConduitPlatform/Conduit/commit/7f2f7d9ae7542551c3cfc372b54de3492756cb27))
* **core:** missing noAuth in health checks ([8de2229](https://github.com/ConduitPlatform/Conduit/commit/8de22291935c7a9ac808a15ad08cd5646044e25b))

### [0.16.17](https://github.com/ConduitPlatform/Conduit/compare/v0.16.16...v0.16.17) (2025-07-10)


### Features

* document the errors that each endpoint throws in Swagger and Apollo ([#1353](https://github.com/ConduitPlatform/Conduit/issues/1353)) ([e8d2cfb](https://github.com/ConduitPlatform/Conduit/commit/e8d2cfbabc98cd91cb9ebb7e9c5ba570bb108757))
* **hermes,chat:** better support event types and auto room joins ([#1338](https://github.com/ConduitPlatform/Conduit/issues/1338)) ([056f127](https://github.com/ConduitPlatform/Conduit/commit/056f127f8bf13e72167789dac5b01ca24a0f2615))


### Bug Fixes

* **chat:** erroneous check of content along with contentType ([9778f74](https://github.com/ConduitPlatform/Conduit/commit/9778f74ae65206446d70dc736e0b57f9fa235dcf))
* **chat:** type/import issues ([b6a8673](https://github.com/ConduitPlatform/Conduit/commit/b6a8673aed3f180e875bfec2a05c45f5c2f3d8b0))
* define module error definition in grpc-sdk instead of module-tools ([#1362](https://github.com/ConduitPlatform/Conduit/issues/1362)) ([e641ce4](https://github.com/ConduitPlatform/Conduit/commit/e641ce45c944a0d01fc782b9c48faf2c435758a0))
* **email:** local handlers wouldn't initialize email variable, when module was available ([146b5d5](https://github.com/ConduitPlatform/Conduit/commit/146b5d563296d1f1f179a61e915219bff4ca0055))

### [0.16.16](https://github.com/ConduitPlatform/Conduit/compare/v0.16.15...v0.16.16) (2025-06-02)


### Features

* add userData in userCreate grpc ([#1350](https://github.com/ConduitPlatform/Conduit/issues/1350)) ([7aa1abf](https://github.com/ConduitPlatform/Conduit/commit/7aa1abf11d68c38be5726f12597ff1295c3e36ae))
* **authentication:** implement metamask authentication mechanism ([#1349](https://github.com/ConduitPlatform/Conduit/issues/1349)) ([aba4809](https://github.com/ConduitPlatform/Conduit/commit/aba480900388d6622484b3abc673efa67e7efad2))
* **chat:** add populate string array param in getMessages ([#1346](https://github.com/ConduitPlatform/Conduit/issues/1346)) ([80fb9ae](https://github.com/ConduitPlatform/Conduit/commit/80fb9ae346b70bb713c707a42c679bcd3aeed460))


### Bug Fixes

* **authentication:** use invitation userData in sendEmail() ([#1348](https://github.com/ConduitPlatform/Conduit/issues/1348)) ([0c48d48](https://github.com/ConduitPlatform/Conduit/commit/0c48d48e3d2e36fa3786e3c135372f1355b58431))

### [0.16.15](https://github.com/ConduitPlatform/Conduit/compare/v0.16.14...v0.16.15) (2025-05-13)


### Features

* **authentication:** delete duplicate team invitation ([#1337](https://github.com/ConduitPlatform/Conduit/issues/1337)) ([cf2cecf](https://github.com/ConduitPlatform/Conduit/commit/cf2cecf966dde8df464a214d27c2e436234c4d6c))
* **authentication:** delete invitation RPC ([#1340](https://github.com/ConduitPlatform/Conduit/issues/1340)) ([d8a48e1](https://github.com/ConduitPlatform/Conduit/commit/d8a48e1337b79b0e7219619044d00f0b8c454fae))
* **authentication:** implement username-based authentication ([#1327](https://github.com/ConduitPlatform/Conduit/issues/1327)) ([58f3066](https://github.com/ConduitPlatform/Conduit/commit/58f3066f8dc90580ab9161de94b82b3692b7c08c))
* **email:** add Mailersend and Amazon SES providers ([#1314](https://github.com/ConduitPlatform/Conduit/issues/1314)) ([afb945c](https://github.com/ConduitPlatform/Conduit/commit/afb945c34c1d1d965771acc80df00a56433ed9cc))
* **email:** email status polling ([#1333](https://github.com/ConduitPlatform/Conduit/issues/1333)) ([3a2d59e](https://github.com/ConduitPlatform/Conduit/commit/3a2d59e51d676b32da89cbc4e99513ed69fcb397))
* **module-tools,router:**  introduce http metrics ([#1332](https://github.com/ConduitPlatform/Conduit/issues/1332)) ([0c2c008](https://github.com/ConduitPlatform/Conduit/commit/0c2c008b0fca0d9aad03ba1076f7f593e5ddd881))


### Bug Fixes

* **authentication:** wrong config checks ([3d63107](https://github.com/ConduitPlatform/Conduit/commit/3d63107026cd3582377f65481931eaffaae676ab))

### [0.16.14](https://github.com/ConduitPlatform/Conduit/compare/v0.16.13...v0.16.14) (2025-04-10)


### Features

* **database:** add visibility metadata for populate param ([#1315](https://github.com/ConduitPlatform/Conduit/issues/1315)) ([ec60d75](https://github.com/ConduitPlatform/Conduit/commit/ec60d75f60e9f27589d3c3fda4477b5cdd5b0754))
* **database:** support description in custom endpoints ([#1318](https://github.com/ConduitPlatform/Conduit/issues/1318)) ([b23a563](https://github.com/ConduitPlatform/Conduit/commit/b23a5632182924cca87a0b82bb15fe732c14b7a3))
* **email:** updateTemplate grpc ([#1320](https://github.com/ConduitPlatform/Conduit/issues/1320)) ([4c563d4](https://github.com/ConduitPlatform/Conduit/commit/4c563d4ac8413698b1e7e2685292ac556216ef9e))
* **module-tools:** introduce status mapping in logs to provide more information ([#1317](https://github.com/ConduitPlatform/Conduit/issues/1317)) ([8154e15](https://github.com/ConduitPlatform/Conduit/commit/8154e15d472ae1eb7d8cc5bc9d3892cbb0ce7b9d))


### Bug Fixes

* **storage:** integration with non-aws providers issues ([#1316](https://github.com/ConduitPlatform/Conduit/issues/1316)) ([5a03665](https://github.com/ConduitPlatform/Conduit/commit/5a036658823cce18d686a2128be78d1e690e41b6))

### [0.16.13](https://github.com/ConduitPlatform/Conduit/compare/v0.16.12...v0.16.13) (2025-04-04)


### Features

* **authentication:** make resend verification threshold configurable ([#1265](https://github.com/ConduitPlatform/Conduit/issues/1265)) ([cc982f0](https://github.com/ConduitPlatform/Conduit/commit/cc982f02be61d4da5c137b394af85cf61d5806d7))
* **authentication:** return email in getInvitationTokenUserData ([#1261](https://github.com/ConduitPlatform/Conduit/issues/1261)) ([483c8a3](https://github.com/ConduitPlatform/Conduit/commit/483c8a3783d082f2d3d72b2dc6cb5abf639e6ace))
* **push-notifications:** integrate Amazon SNS provider ([#1304](https://github.com/ConduitPlatform/Conduit/issues/1304)) ([5e68ce8](https://github.com/ConduitPlatform/Conduit/commit/5e68ce88c30125e5a8b65dc6bce45f8f88013678))


### Bug Fixes

* **authentication:** verify email with code wrongfully tries to redirect ([#1284](https://github.com/ConduitPlatform/Conduit/issues/1284)) ([47d8aab](https://github.com/ConduitPlatform/Conduit/commit/47d8aabb72ed6359eb369ccaf81dfbfd620eebf6))
* **database:** create index type ([#1280](https://github.com/ConduitPlatform/Conduit/issues/1280)) ([d136ecb](https://github.com/ConduitPlatform/Conduit/commit/d136ecbd45d03a83ff272943f83604ccbb837660))
* **functions:** pagination/execution relation/invalid params ([#1264](https://github.com/ConduitPlatform/Conduit/issues/1264)) ([1294bb5](https://github.com/ConduitPlatform/Conduit/commit/1294bb521543228c4c1cf15734acf9bab1aec02f))
* **hermes:** missed uuid types ([d92cc9b](https://github.com/ConduitPlatform/Conduit/commit/d92cc9bd348c54e09cd04f0d801a90eef6b8bdc0))
* **hermes:** swagger ID type causing issues with testing ([#1289](https://github.com/ConduitPlatform/Conduit/issues/1289)) ([31e496d](https://github.com/ConduitPlatform/Conduit/commit/31e496d27d95e753fda1436ff388a4963eb8594b))
* include missing NODE_ENV ([#1310](https://github.com/ConduitPlatform/Conduit/issues/1310)) ([86aebaa](https://github.com/ConduitPlatform/Conduit/commit/86aebaaf0f4829dc8842f1f8005bc070c04b7f63))
* **router:** google recaptcha verification url is incorrect ([#1263](https://github.com/ConduitPlatform/Conduit/issues/1263)) ([2ea88ef](https://github.com/ConduitPlatform/Conduit/commit/2ea88ef000b7d9fb8c959d516e7c67a9f87b2428))

### [0.16.12](https://github.com/ConduitPlatform/Conduit/compare/v0.16.11...v0.16.12) (2024-12-10)


### Bug Fixes

* **authentication:**  grpc-sdk/authentication missing user routes ([#1252](https://github.com/ConduitPlatform/Conduit/issues/1252)) ([6a583b2](https://github.com/ConduitPlatform/Conduit/commit/6a583b2b575d29d8ef9e62d8e4dbdc372b98598d))

### [0.16.11](https://github.com/ConduitPlatform/Conduit/compare/v0.16.10...v0.16.11) (2024-12-09)


### Features

* **authentication:** user activate/deactivate gRPC routes ([#1248](https://github.com/ConduitPlatform/Conduit/issues/1248)) ([37f96b8](https://github.com/ConduitPlatform/Conduit/commit/37f96b8fd1400dea81a39e9f2c58fcc40e214dc7))


### Bug Fixes

* **authentication:** default behaviour on register with invitation token ([#1242](https://github.com/ConduitPlatform/Conduit/issues/1242)) ([21c977f](https://github.com/ConduitPlatform/Conduit/commit/21c977f44ced052636c63e63c84d6084287b73c7))
* **email:** missing default in residency ([57d4705](https://github.com/ConduitPlatform/Conduit/commit/57d47057365b6844b2c880bc56965f6f125329e4))
* scripts/Dockerfile.builder to reduce vulnerabilities ([#1232](https://github.com/ConduitPlatform/Conduit/issues/1232)) ([5b31b82](https://github.com/ConduitPlatform/Conduit/commit/5b31b82f6f2f89572d2dd753ffb2dc33d2e86e06))

### [0.16.10](https://github.com/ConduitPlatform/Conduit/compare/v0.16.9...v0.16.10) (2024-10-21)


### Features

* **authentication:** invitations & additional user data in registration ([#1184](https://github.com/ConduitPlatform/Conduit/issues/1184)) ([5ac198f](https://github.com/ConduitPlatform/Conduit/commit/5ac198febadfa34e9bf64e7295b08eaf62e774fc))
* **authentication:** supportNative setting in providers ([#1170](https://github.com/ConduitPlatform/Conduit/issues/1170)) ([028b315](https://github.com/ConduitPlatform/Conduit/commit/028b3154ec7075b54a9838449319f86dc293de11))


### Bug Fixes

* **authentication, authorization:** teamMembers count, remove default pagination from rpc routes ([#1161](https://github.com/ConduitPlatform/Conduit/issues/1161)) ([b0c562b](https://github.com/ConduitPlatform/Conduit/commit/b0c562be73fc1093cb9addda09a526f526e584ff))
* **database:** canModify extensions remove redundant nested fields check, parse mongo nested update syntax ([#1169](https://github.com/ConduitPlatform/Conduit/issues/1169)) ([be4adbd](https://github.com/ConduitPlatform/Conduit/commit/be4adbd83e4708a58f0771fc563af712023cd32b))
* **database:** wrong query in mongoose findOne ([#1192](https://github.com/ConduitPlatform/Conduit/issues/1192)) ([d527b8a](https://github.com/ConduitPlatform/Conduit/commit/d527b8a805ed334a52f1d70c344817fd7b27098e))

### [0.16.9](https://github.com/ConduitPlatform/Conduit/compare/v0.16.8...v0.16.9) (2024-09-10)


### Features

* **authentication, grpc-sdk:** anonymous users ([#1101](https://github.com/ConduitPlatform/Conduit/issues/1101)) ([6e9f874](https://github.com/ConduitPlatform/Conduit/commit/6e9f8740df6fcb1e59a1167c753a5c83d672c8e6))
* **authorization:** add "soft" param to trigger re-indexing without index wipe ([#1116](https://github.com/ConduitPlatform/Conduit/issues/1116)) ([d01c516](https://github.com/ConduitPlatform/Conduit/commit/d01c516d2c9b5d58a344ff7922633de2de91b535))
* **email:** store emails to db/storage ([#1091](https://github.com/ConduitPlatform/Conduit/issues/1091)) ([3e2792c](https://github.com/ConduitPlatform/Conduit/commit/3e2792c9bcd9264348239e2c0274c5cb7a67cab7))
* **storage:** file aliases ([#1096](https://github.com/ConduitPlatform/Conduit/issues/1096)) ([bf3f63f](https://github.com/ConduitPlatform/Conduit/commit/bf3f63ffe7888c048742059df34f5970140fc85f))


### Bug Fixes

* **authentication, grpc-sdk:** team owner deletion bug ([#1097](https://github.com/ConduitPlatform/Conduit/issues/1097)) ([84c0a4a](https://github.com/ConduitPlatform/Conduit/commit/84c0a4a837726c631c0b63ca18c90cbe0ecc7636))
* **authentication:** type bug ([#1134](https://github.com/ConduitPlatform/Conduit/issues/1134)) ([8604b92](https://github.com/ConduitPlatform/Conduit/commit/8604b929c39848ca7649db170d8cbb4675dce61f))
* **authentication:** UserLogin, GetTeam RPCs ([#1128](https://github.com/ConduitPlatform/Conduit/issues/1128)) ([a979dc3](https://github.com/ConduitPlatform/Conduit/commit/a979dc336c63b0f7eccd029a2ea9a4f681a3cc66))
* **database:** canModify does not check flattened group extension fields ([#1136](https://github.com/ConduitPlatform/Conduit/issues/1136)) ([1eef736](https://github.com/ConduitPlatform/Conduit/commit/1eef7369790daeedd16ecf046dc38428f88fed08))
* **database:** mongoose bump issues ([6c97b1c](https://github.com/ConduitPlatform/Conduit/commit/6c97b1ca7062355694a1f0d97f6ffe2b3ccfcf36))
* **email:** sync templates/SendGrid provider eu domain/Email providers missing config fields error handling/GetExternalTemplates error handling ([#1146](https://github.com/ConduitPlatform/Conduit/issues/1146)) ([4e17224](https://github.com/ConduitPlatform/Conduit/commit/4e172247f7e1d2b29924a4da163de432e0dd8744))
* scripts/Dockerfile.builder to reduce vulnerabilities ([#1094](https://github.com/ConduitPlatform/Conduit/issues/1094)) ([edbc1f0](https://github.com/ConduitPlatform/Conduit/commit/edbc1f0f81ee23c827c950a80bafce72771ba78f))
* **storage:** getFolders by parent/root/all ([#1102](https://github.com/ConduitPlatform/Conduit/issues/1102)) ([5f9b8db](https://github.com/ConduitPlatform/Conduit/commit/5f9b8db879821bc258869bfcbe468d0fd47effa2))
* **storage:** search files alias integration ([#1114](https://github.com/ConduitPlatform/Conduit/issues/1114)) ([b272286](https://github.com/ConduitPlatform/Conduit/commit/b27228685ab3c7084a7fecbc57514a7d6e802d87))

### [0.16.8](https://github.com/ConduitPlatform/Conduit/compare/v0.16.7...v0.16.8) (2024-07-19)


### Features

* **authentication:** allow setting redirectUri for invites ([#1093](https://github.com/ConduitPlatform/Conduit/issues/1093)) ([066ec7f](https://github.com/ConduitPlatform/Conduit/commit/066ec7f8e73754f418a6f1b41d7df59b014be680))
* **authentication:** verify user email via code ([#1092](https://github.com/ConduitPlatform/Conduit/issues/1092)) ([8bae7be](https://github.com/ConduitPlatform/Conduit/commit/8bae7bea62534b6412f4601997c09ed8339b9c06))


### Bug Fixes

* **grpc-sdk,module-tools:** exports structure in package.json, to solve NextJS issues ([89c0f49](https://github.com/ConduitPlatform/Conduit/commit/89c0f49a4b5b00b035124f09e5accd0d13ecfc7a))

### [0.16.7](https://github.com/ConduitPlatform/Conduit/compare/v0.16.6...v0.16.7) (2024-07-03)

### [0.16.6](https://github.com/ConduitPlatform/Conduit/compare/v0.16.5...v0.16.6) (2024-07-02)


### Features

* **grpc-sdk,module-tools:** support commonjs projects ([#1089](https://github.com/ConduitPlatform/Conduit/issues/1089)) ([28e62ff](https://github.com/ConduitPlatform/Conduit/commit/28e62ff2e0f6fddf0563941739579506579e9ac9))
* **push-notifications:** delete expired tokens for one-signal provider ([#1088](https://github.com/ConduitPlatform/Conduit/issues/1088)) ([e88211f](https://github.com/ConduitPlatform/Conduit/commit/e88211faee4da4a26aa532dfa0684cd96aff807f))


### Bug Fixes

* **database:** view fixes ([#1086](https://github.com/ConduitPlatform/Conduit/issues/1086)) ([f82aa42](https://github.com/ConduitPlatform/Conduit/commit/f82aa4234600bbc696def0d75e2aad837cec1c23))

### [0.16.5](https://github.com/ConduitPlatform/Conduit/compare/v0.16.4...v0.16.5) (2024-05-29)


### Features

* **authentication:** add user to default team when creating through gRPC ([ae7962d](https://github.com/ConduitPlatform/Conduit/commit/ae7962d2f284a13f21b4b7c583a6b5a758da97a0))
* **authentication:** remove verification requirement for forgot password ([369958f](https://github.com/ConduitPlatform/Conduit/commit/369958ff81de9ec94b1353d8a60dcbf28aec46b0))
* **authentication:** validate team invites before user creation for all authentication methods ([#1014](https://github.com/ConduitPlatform/Conduit/issues/1014)) ([49fba37](https://github.com/ConduitPlatform/Conduit/commit/49fba3724b2d70699df0d461e8b060a5ec6e4c2d))
* **storage:** introduce gRPC call to get a file's URL ([#1045](https://github.com/ConduitPlatform/Conduit/issues/1045)) ([4979402](https://github.com/ConduitPlatform/Conduit/commit/4979402dab7bd3f603c025dd27082bef0a5ab296))


### Bug Fixes

* **authorization:** inherited permissions with wildcard ([46f801d](https://github.com/ConduitPlatform/Conduit/commit/46f801df83f4f5726f15a3157ae7172f22a597e2))
* **chat:** createRoom admin API participants validation ([#1016](https://github.com/ConduitPlatform/Conduit/issues/1016)) ([e7d2367](https://github.com/ConduitPlatform/Conduit/commit/e7d2367e60499da0b9b8a5cc63ed9a4da60bcfaf))
* **database:** cannot create documents with only scope ([396984b](https://github.com/ConduitPlatform/Conduit/commit/396984be4c96b1ea5c171e7422d2c0bed6b32b2d))
* pushNotifications health updates ([#1039](https://github.com/ConduitPlatform/Conduit/issues/1039)) ([dcb0235](https://github.com/ConduitPlatform/Conduit/commit/dcb0235d034e742dca4d07f6965b671751ba4185))
* **storage:** inconsistent behavior for admin handlers ([bea5137](https://github.com/ConduitPlatform/Conduit/commit/bea513744b997cfe906ff393ff94eb742f371398))

### [0.16.4](https://github.com/ConduitPlatform/Conduit/compare/v0.16.3...v0.16.4) (2024-03-29)


### Bug Fixes

* **authentication:** typo on merge dependency ([64ecad6](https://github.com/ConduitPlatform/Conduit/commit/64ecad6b9cbbce47d8f2165d86592e8ffe5d5dcd))

### [0.16.3](https://github.com/ConduitPlatform/Conduit/compare/v0.16.2...v0.16.3) (2024-03-29)


### Features

* **authentication:** endpoint to update team name ([#972](https://github.com/ConduitPlatform/Conduit/issues/972)) ([f272588](https://github.com/ConduitPlatform/Conduit/commit/f27258865ca035a8a2623729b0e5a0c10c89d662))
* **authentication:** merge payload on oAuth user updates so that older data is not deleted ([47cd688](https://github.com/ConduitPlatform/Conduit/commit/47cd6882f020ce3cbe5c131d66a46e9ba0faf8cd))


### Bug Fixes

* **authentication:** apple data not stored ([d54fb43](https://github.com/ConduitPlatform/Conduit/commit/d54fb43fd19309cdfb6cd57a10ddb16fddee7415))
* **authentication:** apple data not stored ([8f250f2](https://github.com/ConduitPlatform/Conduit/commit/8f250f2583e5aef5794ea39516edc0104025514c))
* **authentication:** apple data not stored ([db2150c](https://github.com/ConduitPlatform/Conduit/commit/db2150c2b9c01767e3ccaf5852e8dbcd41f0aadc))
* **authentication:** missing oAuth fields in user model ([4b28b9f](https://github.com/ConduitPlatform/Conduit/commit/4b28b9f38187db9d2e5669bbf6ae0d52c02ccad6))
* **database:** schema object field access validation checks ([#996](https://github.com/ConduitPlatform/Conduit/issues/996)) ([535cb9e](https://github.com/ConduitPlatform/Conduit/commit/535cb9e05540aa92c277bde6303844e6ee3a4496))

### [0.16.2](https://github.com/ConduitPlatform/Conduit/compare/v0.16.1...v0.16.2) (2024-03-02)


### Bug Fixes

* **authentication:** missing redirect nullity check ([d292960](https://github.com/ConduitPlatform/Conduit/commit/d292960cfbec640d32bdbca079e926b98579c4bc))
* **authentication:** team fetching pagination issues ([f70ae93](https://github.com/ConduitPlatform/Conduit/commit/f70ae9312abfa0cf691304ff0628da8ce1a44658))

### [0.16.1](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0...v0.16.1) (2024-02-27)


### Features

* **router:** add info log for consumed limits ([#959](https://github.com/ConduitPlatform/Conduit/issues/959)) ([b8b8d9a](https://github.com/ConduitPlatform/Conduit/commit/b8b8d9ae0922c069e867ee8ddb584c265690dcc9))


### Bug Fixes

* **authentication:** admin-defined redirectUri for email verification mistakenly validated ([#966](https://github.com/ConduitPlatform/Conduit/issues/966)) ([33872dc](https://github.com/ConduitPlatform/Conduit/commit/33872dc95b38c6830bc2f9f411653fdd13ed3ce7))

## [0.16.0](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-rc.5...v0.16.0) (2024-02-17)


### Features

* **authorization,grpc-sdk:** CreateResourceAccessList viewName ([#955](https://github.com/ConduitPlatform/Conduit/issues/955)) ([74a464e](https://github.com/ConduitPlatform/Conduit/commit/74a464ed0f96a33b9916f530813c9c28edd2b0ca))


### Bug Fixes

* **authorization:** createResourceAccessList API breakage ([#956](https://github.com/ConduitPlatform/Conduit/issues/956)) ([a12bf88](https://github.com/ConduitPlatform/Conduit/commit/a12bf88b68f688ee35a2cd1bec084ea3041f6725))
* **authorization:** error case in index builds for older environments ([88d4ddd](https://github.com/ConduitPlatform/Conduit/commit/88d4ddde1fb07f44b7528a5e71d1c41fdd4969a3))
* **authorization:** jobs esm ([392187c](https://github.com/ConduitPlatform/Conduit/commit/392187c735982e4a71fe8030dc08da7d6caf3cf0))
* **authorization:** requestedViewName empty check ([e02674c](https://github.com/ConduitPlatform/Conduit/commit/e02674c5c179a4f6c5f8d914af08732074048a2c))
* ecosystem.config.js wrong port mapping ([9ed6867](https://github.com/ConduitPlatform/Conduit/commit/9ed68672e28f23aa3314b1d1242b0333deb2c120))
* wrong docker image  url for standalone production ([6b01555](https://github.com/ConduitPlatform/Conduit/commit/6b0155594401291e90c945c31a21845626a00dac))

## [0.16.0-rc.5](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-rc.4...v0.16.0-rc.5) (2024-02-06)


### Features

* **grpc-sdk:** set maxRetriesPerRequest null in redis clients ([c260a76](https://github.com/ConduitPlatform/Conduit/commit/c260a7616475086c82061969aada22b181fd928a))


### Bug Fixes

* **core:** config manager route recovery broken ([812cfd8](https://github.com/ConduitPlatform/Conduit/commit/812cfd84739601d875cbd914f26a68960f55c12e))

## [0.16.0-rc.4](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-rc.3...v0.16.0-rc.4) (2024-01-31)


### Features

* **hermes,admin,router:** add server and error details in swagger ([#929](https://github.com/ConduitPlatform/Conduit/issues/929)) ([88294fe](https://github.com/ConduitPlatform/Conduit/commit/88294fe16c82d1e1e772af70293073989b49cb26))
* **hermes:** add scalar to eventually replace swagger ui ([#921](https://github.com/ConduitPlatform/Conduit/issues/921)) ([b2ee37c](https://github.com/ConduitPlatform/Conduit/commit/b2ee37c68312b32e30608459fb3441972b8c29c6))
* standalone docker image ([#919](https://github.com/ConduitPlatform/Conduit/issues/919)) ([0accd64](https://github.com/ConduitPlatform/Conduit/commit/0accd64642431ded77cbc291f42d106758b18956))


### Bug Fixes

* build command for standalone ([bedf994](https://github.com/ConduitPlatform/Conduit/commit/bedf9940e6c37e001bae1ecd1e8baba2e4c2ec79))
* checkRelations not finding resource definitions ([#909](https://github.com/ConduitPlatform/Conduit/issues/909)) ([7d25f4d](https://github.com/ConduitPlatform/Conduit/commit/7d25f4d8aaa56ed09dda8a8ead1c02e31239756e))
* **database:** execRawQuery check if collection exists in views ([#932](https://github.com/ConduitPlatform/Conduit/issues/932)) ([387c296](https://github.com/ConduitPlatform/Conduit/commit/387c29695ca65563172e034a43ea6dd3913e1f09))
* **database:** mongoose parseStringToQuery EJSON -> JSON ([#926](https://github.com/ConduitPlatform/Conduit/issues/926)) ([38d7ab0](https://github.com/ConduitPlatform/Conduit/commit/38d7ab0c6dbefe1bab3d4e15daedeb862e0e9e46))
* **database:** views not being shared between instances ([#910](https://github.com/ConduitPlatform/Conduit/issues/910)) ([b44302d](https://github.com/ConduitPlatform/Conduit/commit/b44302db05852ec576dd5125b46703187e7dfef5))
* **grpc-sdk:** ConduitSchemaExtension type not exported ([#908](https://github.com/ConduitPlatform/Conduit/issues/908)) ([a37bb7a](https://github.com/ConduitPlatform/Conduit/commit/a37bb7a8ddb0cecd7ce81b005ebbe1c747c877ca))
* **hermes:** keeping previous middlewares between route updates ([9f7a785](https://github.com/ConduitPlatform/Conduit/commit/9f7a78566f9ef22a559178618fe610a474c90ded))
* **router,admin:** register route crashing between database restarts, ([#907](https://github.com/ConduitPlatform/Conduit/issues/907)) ([9bc8cb0](https://github.com/ConduitPlatform/Conduit/commit/9bc8cb0f4f34b3c0a30878d02897cad164bcd46c))
* standalone Docker compose port mapping ([#922](https://github.com/ConduitPlatform/Conduit/issues/922)) ([a1dd80f](https://github.com/ConduitPlatform/Conduit/commit/a1dd80f5b6b7f595e71179e39549add192f75bb2))

## [0.16.0-rc.3](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-rc.2...v0.16.0-rc.3) (2024-01-18)


### Features

* **core:** better logging for module state updates ([44599ef](https://github.com/ConduitPlatform/Conduit/commit/44599ef69514fbbdfb3ff6631bac21249a686451))


### Bug Fixes

* **authorization:** missing relation size check in reindex ([41e7d2d](https://github.com/ConduitPlatform/Conduit/commit/41e7d2dbc06fe9d4331e5d0791522e8679cd0281))

## [0.16.0-rc.2](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-rc.1...v0.16.0-rc.2) (2024-01-18)


### Features

* **authentication:** Add/RemoveTeamMembers gRPC rpcs ([#885](https://github.com/ConduitPlatform/Conduit/issues/885)) ([9bbd18d](https://github.com/ConduitPlatform/Conduit/commit/9bbd18d35f8b0c6a2ca519c4f9e76acd0b36d172))


### Bug Fixes

* add catch at createView() ([#890](https://github.com/ConduitPlatform/Conduit/issues/890)) ([17f97e5](https://github.com/ConduitPlatform/Conduit/commit/17f97e5bc9829bce04af3bfb034730fb2f152cd3))
* **authentication:** add/removeTeamMember rpc field mapping ([#894](https://github.com/ConduitPlatform/Conduit/issues/894)) ([c4d9ce3](https://github.com/ConduitPlatform/Conduit/commit/c4d9ce3883700e9c2873ac2579238d1d2501ee27))
* **authentication:** apple strategy using provider ([8f379b6](https://github.com/ConduitPlatform/Conduit/commit/8f379b6be57ad609946af439abca0e74a64e7acd))
* **authentication:** facebook and google native login missing scopes ([#887](https://github.com/ConduitPlatform/Conduit/issues/887)) ([470798e](https://github.com/ConduitPlatform/Conduit/commit/470798e47b919be331417811ad619c23bf991987))
* **database:** high-availability issues especially on SQL dbs ([#899](https://github.com/ConduitPlatform/Conduit/issues/899)) ([db7c1f8](https://github.com/ConduitPlatform/Conduit/commit/db7c1f8ee16c32f0de5af68afbfc7a0afa68464c))
* group field custom endpoints query bug ([#893](https://github.com/ConduitPlatform/Conduit/issues/893)) ([73be8c5](https://github.com/ConduitPlatform/Conduit/commit/73be8c510f1310d30d6749ce27b876045b429adc))

## [0.16.0-rc.1](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-rc.0...v0.16.0-rc.1) (2024-01-10)


### Features

* **authentication:** redirectUri overrides expansion ([#884](https://github.com/ConduitPlatform/Conduit/issues/884)) ([2ab2eb3](https://github.com/ConduitPlatform/Conduit/commit/2ab2eb3f9c5de07453666e6d835f63e440044616))
* **authentication:** rm oldPassword body param from /local/change-password ([#863](https://github.com/ConduitPlatform/Conduit/issues/863)) ([75c7f4f](https://github.com/ConduitPlatform/Conduit/commit/75c7f4fec8a935bd46c5eac6be5e7cef7ad4dab5))
* **authorization:** ResourceDefinition versioning, bus event pub fixes, admin API res signature fixes ([#881](https://github.com/ConduitPlatform/Conduit/issues/881)) ([30c2c86](https://github.com/ConduitPlatform/Conduit/commit/30c2c863322f6b5bc40b2c148125258dcaf7e26e))


### Bug Fixes

* **authentication:** OAuth provider redirect URIs containing double query question marks ([#855](https://github.com/ConduitPlatform/Conduit/issues/855)) ([6ce4173](https://github.com/ConduitPlatform/Conduit/commit/6ce4173530d110ae877e19ef7c72abe06c375501))
* **authorization:** jobs not being processed correctly ([#841](https://github.com/ConduitPlatform/Conduit/issues/841)) ([80f4e64](https://github.com/ConduitPlatform/Conduit/commit/80f4e645a8a482a267a627db3a03fc685be7092d))
* **core:** missing check for double removal of unresponsive module ([#850](https://github.com/ConduitPlatform/Conduit/issues/850)) ([74ba6d5](https://github.com/ConduitPlatform/Conduit/commit/74ba6d5db0541f606074d16929343bde0ee7ab4b))
* **email:** wrong object access in email config ([d2c957e](https://github.com/ConduitPlatform/Conduit/commit/d2c957eecc8c18798daecf9cbd10e3739b70e631))
* **grpc-sdk:** health check middleware injection ([#851](https://github.com/ConduitPlatform/Conduit/issues/851)) ([cb27906](https://github.com/ConduitPlatform/Conduit/commit/cb279068c6408b36339b381c837e8de7cca7e83a))
* **grpc-sdk:** module connection not re-established after core shutdown ([#858](https://github.com/ConduitPlatform/Conduit/issues/858)) ([b7ce4b5](https://github.com/ConduitPlatform/Conduit/commit/b7ce4b59a6f7df438b37ecf652c92aa219d3bf48))
* modules/authentication/package.json to reduce vulnerabilities ([#867](https://github.com/ConduitPlatform/Conduit/issues/867)) ([99ed9d0](https://github.com/ConduitPlatform/Conduit/commit/99ed9d008f44c42ebfcb1df6853df36e1da21102))
* modules/router/package.json to reduce vulnerabilities ([#868](https://github.com/ConduitPlatform/Conduit/issues/868)) ([9b2c31c](https://github.com/ConduitPlatform/Conduit/commit/9b2c31c5e5e06b8419e0b51aedd493226a3b041f))

## [0.16.0-rc.0](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.29...v0.16.0-rc.0) (2023-12-01)


### Features

* **authorization:** Queue controller, construct indexes job ([#807](https://github.com/ConduitPlatform/Conduit/issues/807)) ([68bac6c](https://github.com/ConduitPlatform/Conduit/commit/68bac6cf5aab0dc1bf040618fb4b304af965752b))
* **database:** add import/export extensions logic to existing endpoints ([#683](https://github.com/ConduitPlatform/Conduit/issues/683)) ([22c1e10](https://github.com/ConduitPlatform/Conduit/commit/22c1e100dede37541a36af609dc9f3e99068a9dc))


### Bug Fixes

* **authentication:** unconditional team admin endpoint registration ([#800](https://github.com/ConduitPlatform/Conduit/issues/800)) ([f21b166](https://github.com/ConduitPlatform/Conduit/commit/f21b1665c037d083b5acbf53a17d502b1a0b4cfd))
* **authorization:** createView() sql queries failing due to unpreserved camel case olumn names ([#822](https://github.com/ConduitPlatform/Conduit/issues/822)) ([3286eec](https://github.com/ConduitPlatform/Conduit/commit/3286eec18d2520e9347bcb10ee50a230b7816386))
* **database:** findOne() null query filters ([#806](https://github.com/ConduitPlatform/Conduit/issues/806)) ([5ba4e74](https://github.com/ConduitPlatform/Conduit/commit/5ba4e748073f355b00d0a013cbf953148813e62d)), closes [#805](https://github.com/ConduitPlatform/Conduit/issues/805)
* **database:** gRPC findMany() empty sort handling ([#810](https://github.com/ConduitPlatform/Conduit/issues/810)) ([3b8ae1f](https://github.com/ConduitPlatform/Conduit/commit/3b8ae1f1d1e9be7b8e16d1a836eedc4dd883906a))
* **database:** sql createSchemaFromAdapter() drop views on schema view exists constraint ([#823](https://github.com/ConduitPlatform/Conduit/issues/823)) ([1d3f808](https://github.com/ConduitPlatform/Conduit/commit/1d3f80819dfdc415e7ce4ec970d05692ffef6383))
* missed null parsedQuery case ([#805](https://github.com/ConduitPlatform/Conduit/issues/805)) ([21628e0](https://github.com/ConduitPlatform/Conduit/commit/21628e0d714b23e2c9f382a4da5e8c139911df59))
* **module-tools:** error message parsing from unexpected/unhandled errors ([#824](https://github.com/ConduitPlatform/Conduit/issues/824)) ([7cb3e8c](https://github.com/ConduitPlatform/Conduit/commit/7cb3e8c175f0cc78b61cee8abe95c933e8b5a7d5))
* **module-tools:** module name not correctly converted for subscriptions ([#819](https://github.com/ConduitPlatform/Conduit/issues/819)) ([5898a8f](https://github.com/ConduitPlatform/Conduit/commit/5898a8f244e800f1eae025f899c398a46ac8ea28))
* **router:** route Swagger doc missing non-global security headers ([#818](https://github.com/ConduitPlatform/Conduit/issues/818)) ([23a425c](https://github.com/ConduitPlatform/Conduit/commit/23a425caefd5c1b8f54103744df388b5e41a1949))

## [0.16.0-alpha.29](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.28...v0.16.0-alpha.29) (2023-11-16)


### Features

* **chat:** introduce auditMode, room deletions on leave and remove unique name requirement from rooms ([#794](https://github.com/ConduitPlatform/Conduit/issues/794)) ([1fc4484](https://github.com/ConduitPlatform/Conduit/commit/1fc4484124eff8de5ecfc02b5a12c1691383dc99))


### Bug Fixes

* **chat:** wrong migration query ([b02721e](https://github.com/ConduitPlatform/Conduit/commit/b02721e20308f3f21ab53cd1091f990231c935bf))
* **chat:** wrong migration query ([d777ee8](https://github.com/ConduitPlatform/Conduit/commit/d777ee82b43235ef811c6df0b1dabbd55a6489b0))
* **chat:** wrong migration query ([21d2e49](https://github.com/ConduitPlatform/Conduit/commit/21d2e49d1410e592fe9a91342e82624ca7fa9bb4))
* **database:** custom endpoint date casting conflict with mongoose casts ([#795](https://github.com/ConduitPlatform/Conduit/issues/795)) ([5c2425c](https://github.com/ConduitPlatform/Conduit/commit/5c2425c7fd760d3ad4d8fb08a3eb03a9075c4783))
* **storage:** authorization checks not consistent with db permissions ([2202583](https://github.com/ConduitPlatform/Conduit/commit/22025832de11e6c410f0d985c4e6b40fcab7a567))

## [0.16.0-alpha.28](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.26...v0.16.0-alpha.28) (2023-11-14)


### Bug Fixes

* **authorization:** migration wrong iterator ([2a28d08](https://github.com/ConduitPlatform/Conduit/commit/2a28d081acf53ebfa8f1c62d0358ed49f68c22d2))
* **authorization:** migrations not checking for missing fields properly ([b49949e](https://github.com/ConduitPlatform/Conduit/commit/b49949e658fefb43f5d7c7bbadf66bcf837b5e39))
* **authorization:** missing subject/resource id in create relation ([1481f6e](https://github.com/ConduitPlatform/Conduit/commit/1481f6e1beb6f26d85cd4b5ad10b161e484cf38d))
* **authorization:** wrong operator on matching pipeline ([930657d](https://github.com/ConduitPlatform/Conduit/commit/930657ded00732d66bf4776456b1fbcd5e92a2ed))

## [0.16.0-alpha.27](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.26...v0.16.0-alpha.27) (2023-11-14)


### Bug Fixes

* **authorization:** migration wrong iterator ([2a28d08](https://github.com/ConduitPlatform/Conduit/commit/2a28d081acf53ebfa8f1c62d0358ed49f68c22d2))
* **authorization:** migrations not checking for missing fields properly ([b49949e](https://github.com/ConduitPlatform/Conduit/commit/b49949e658fefb43f5d7c7bbadf66bcf837b5e39))
* **authorization:** missing subject/resource id in create relation ([1481f6e](https://github.com/ConduitPlatform/Conduit/commit/1481f6e1beb6f26d85cd4b5ad10b161e484cf38d))
* **authorization:** wrong operator on matching pipeline ([930657d](https://github.com/ConduitPlatform/Conduit/commit/930657ded00732d66bf4776456b1fbcd5e92a2ed))

## [0.16.0-alpha.26](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.25...v0.16.0-alpha.26) (2023-11-09)


### Bug Fixes

* **authentication:** admin team name change not checking name availability ([#786](https://github.com/ConduitPlatform/Conduit/issues/786)) ([c526a34](https://github.com/ConduitPlatform/Conduit/commit/c526a34da963f663bd6429374df827d95136560e))
* **authentication:** error log not showing properly ([460904b](https://github.com/ConduitPlatform/Conduit/commit/460904bb964ceb972c64cd0ccbe098036c721424))

## [0.16.0-alpha.25](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.24...v0.16.0-alpha.25) (2023-11-01)


### Bug Fixes

* **authentication:** not logging authn errors properly in oAuth2 ([68993af](https://github.com/ConduitPlatform/Conduit/commit/68993afa9c64130ce183dcfb4752f43c7cbdffef))
* **hermes:** cumulative middleware context ([#771](https://github.com/ConduitPlatform/Conduit/issues/771)) ([65dbfac](https://github.com/ConduitPlatform/Conduit/commit/65dbfac5376b2f22c5dc2318637e2437bdeb86db))
* model controller class constructor visibility ([#781](https://github.com/ConduitPlatform/Conduit/issues/781)) ([0cfe373](https://github.com/ConduitPlatform/Conduit/commit/0cfe3734b43865010ec3acc5ec564adca8ca23ba))

## [0.16.0-alpha.24](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.23...v0.16.0-alpha.24) (2023-10-26)


### Features

* **chat:** add config to delete rooms when participants have left ([#764](https://github.com/ConduitPlatform/Conduit/issues/764)) ([1f7d31f](https://github.com/ConduitPlatform/Conduit/commit/1f7d31fa7a640426a1edb9ae05f3cc1750d410d0))


### Bug Fixes

* ts-proto snake_case to camelCase, Chat.gRPC.createRoom() empty id res field ([#770](https://github.com/ConduitPlatform/Conduit/issues/770)) ([510b2be](https://github.com/ConduitPlatform/Conduit/commit/510b2be597e44bb848f374c138c20b224f983211))

## [0.16.0-alpha.23](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.22...v0.16.0-alpha.23) (2023-10-24)


### Features

* **authentication,grpc-sdk:** ValidateAccessToken gRPC method ([#729](https://github.com/ConduitPlatform/Conduit/issues/729)) ([8733eea](https://github.com/ConduitPlatform/Conduit/commit/8733eea2903633e060971daf2f7593a000c3c771))
* **authentication:** configurable magicLink dispatch URI, magic token consumption endpoint ([#722](https://github.com/ConduitPlatform/Conduit/issues/722)) ([64d4714](https://github.com/ConduitPlatform/Conduit/commit/64d47142a0d534c24b4b72022a29e26ee572a1a5))
* **router:** request rate limit configuration ([#760](https://github.com/ConduitPlatform/Conduit/issues/760)) ([5629cb3](https://github.com/ConduitPlatform/Conduit/commit/5629cb3736a182b220a2b840b4819793242af3e0))


### Bug Fixes

* **authentication:** sendMagicLink missing redirectUri, magic link hook invalid redirectUri param type ([#716](https://github.com/ConduitPlatform/Conduit/issues/716)) ([911d795](https://github.com/ConduitPlatform/Conduit/commit/911d795f6477ed549dd2882f2f371a88fa5bcf05))
* **grpc-sdk:** push notifications responses type mismatch ([#731](https://github.com/ConduitPlatform/Conduit/issues/731)) ([2b981c5](https://github.com/ConduitPlatform/Conduit/commit/2b981c5230701d094f6b9f21e84769fc76a10b92))
* **hermes,router,admin:** Swagger missing optional authMiddleware headers, conditional security client headers ([#728](https://github.com/ConduitPlatform/Conduit/issues/728)) ([0e074c0](https://github.com/ConduitPlatform/Conduit/commit/0e074c0dc97db6375c7d9cc276b2e011f2c8a00b))
* **router:** disable rate limiter for sockets due to IP not being available ([#730](https://github.com/ConduitPlatform/Conduit/issues/730)) ([8d7c0d9](https://github.com/ConduitPlatform/Conduit/commit/8d7c0d90bee1c464eb37c46a3e242b85e5b0a1aa))

## [0.16.0-alpha.22](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.21...v0.16.0-alpha.22) (2023-10-09)


### Bug Fixes

* **database:** update/delete operations authz checks, sql authz/dialect parsing order ([#706](https://github.com/ConduitPlatform/Conduit/issues/706)) ([0e49e7b](https://github.com/ConduitPlatform/Conduit/commit/0e49e7b0070d0104f4fc207efe9e81ace6b1fc04))
* delete permissions ([#710](https://github.com/ConduitPlatform/Conduit/issues/710)) ([6808d38](https://github.com/ConduitPlatform/Conduit/commit/6808d382f6df5d3977a3235f941bb668f7a577fa))
* **grpc-sdk:** redis password env setting redis username ([#705](https://github.com/ConduitPlatform/Conduit/issues/705)) ([fcb4d32](https://github.com/ConduitPlatform/Conduit/commit/fcb4d328152edebd1a6cbb33ac4648cc9526af71))

## [0.16.0-alpha.21](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.20...v0.16.0-alpha.21) (2023-10-05)


### Features

* **authorization, database:**  create bulk relations in authorization ([#681](https://github.com/ConduitPlatform/Conduit/issues/681)) ([d48d7b3](https://github.com/ConduitPlatform/Conduit/commit/d48d7b38b33b669311b2e20ead015df750a7675c))
* biometric authentication for mobile devices ([#693](https://github.com/ConduitPlatform/Conduit/issues/693)) ([d69ff51](https://github.com/ConduitPlatform/Conduit/commit/d69ff51fc43176967355f7982e858dcd3e443b88))


### Bug Fixes

* **authentication:** biometrics issues ([#695](https://github.com/ConduitPlatform/Conduit/issues/695)) ([3902715](https://github.com/ConduitPlatform/Conduit/commit/390271523dccf323af5e379687e2ebb3bf431baf))
* **core:** config schema array field parsing ([#691](https://github.com/ConduitPlatform/Conduit/issues/691)) ([0a06464](https://github.com/ConduitPlatform/Conduit/commit/0a06464775c2b78e523c62a9c1c1a7fe1ee0c0d0))
* **database:** _parseQuery() dropping query fields ([#677](https://github.com/ConduitPlatform/Conduit/issues/677)) ([fb0f7ce](https://github.com/ConduitPlatform/Conduit/commit/fb0f7ce4fa717cd24aae9d8b045159fbc1903977))
* **database:** schema/extension creation timestamp field values mismatch ([#682](https://github.com/ConduitPlatform/Conduit/issues/682)) ([1543e07](https://github.com/ConduitPlatform/Conduit/commit/1543e07fd85e8891593c6af409cf5f88872298cc))
* **database:** SQL create/createMany relation parsing, group unwrapping ([#676](https://github.com/ConduitPlatform/Conduit/issues/676)) ([0784716](https://github.com/ConduitPlatform/Conduit/commit/07847164dff277fa32470f5e7124c6c9ff3af5c0))
* **database:** sql createView() already exists race condition ([#688](https://github.com/ConduitPlatform/Conduit/issues/688)) ([e78cde4](https://github.com/ConduitPlatform/Conduit/commit/e78cde481894fcb1349882c5b2a3b4921d8046cd))
* **database:** sql findByIdAndReplace() setting _id, createdAt to undefined ([#679](https://github.com/ConduitPlatform/Conduit/issues/679)) ([e90ce7b](https://github.com/ConduitPlatform/Conduit/commit/e90ce7bd478647e9610ed5d73a35b11f8d5225a0))
* grpc await promise transpilation, bump ecmascript target to es2018 ([#689](https://github.com/ConduitPlatform/Conduit/issues/689)) ([8058195](https://github.com/ConduitPlatform/Conduit/commit/8058195511f0a0ccc7141a685e23225bd8413562))
* **hermes:** graphQl null array responses ([#675](https://github.com/ConduitPlatform/Conduit/issues/675)) ([01c2ad8](https://github.com/ConduitPlatform/Conduit/commit/01c2ad82a8eb52f1eaf22908df65e6f1fb899e8d))
* **hermes:** graphQl parser constructResolver() unpopulated relation field formatting ([#680](https://github.com/ConduitPlatform/Conduit/issues/680)) ([7e0bb8e](https://github.com/ConduitPlatform/Conduit/commit/7e0bb8e814b13f8af7b851a9742bed7056399ae6))
* **hermes:** object-hash issues ([9f3ed29](https://github.com/ConduitPlatform/Conduit/commit/9f3ed291aca76bd81f2c0b0f34351ec5a94b7536))
* **hermes:** swagger/graphql parsers not pulling related db schema types ([#687](https://github.com/ConduitPlatform/Conduit/issues/687)) ([057828a](https://github.com/ConduitPlatform/Conduit/commit/057828a5b79b8c4dd4b989bd3d4ed2b5610a8aed))

## [0.16.0-alpha.20](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.19...v0.16.0-alpha.20) (2023-08-30)


### Bug Fixes

* **database:** missing fields reduce in permission check ([1efc868](https://github.com/ConduitPlatform/Conduit/commit/1efc868ba49a302d4af8acb5baabf5f59c3773d1))

## [0.16.0-alpha.19](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.18...v0.16.0-alpha.19) (2023-08-30)


### Bug Fixes

* **authorization:** Postgres access list query ([#666](https://github.com/ConduitPlatform/Conduit/issues/666)) ([1b92a09](https://github.com/ConduitPlatform/Conduit/commit/1b92a099cd1c291ae61c647a2d13941f2b12336a))
* **database:** permission checks for extensions ([#671](https://github.com/ConduitPlatform/Conduit/issues/671)) ([9edf2d1](https://github.com/ConduitPlatform/Conduit/commit/9edf2d1e592e56286554e3c381fa9e2f6e10b180))
* **database:** sql authorized findMany queries ([#668](https://github.com/ConduitPlatform/Conduit/issues/668)) ([f98c18a](https://github.com/ConduitPlatform/Conduit/commit/f98c18a3e29205de2a6b2448a07bae58780a9bcd))
* **database:** sql authorized findOne query ([#669](https://github.com/ConduitPlatform/Conduit/issues/669)) ([04458f1](https://github.com/ConduitPlatform/Conduit/commit/04458f1f707c94773c5f9ee85ed5c50a76b5491c))
* **database:** sql findMany authorized pagination ([#670](https://github.com/ConduitPlatform/Conduit/issues/670)) ([e642ebb](https://github.com/ConduitPlatform/Conduit/commit/e642ebb6575fac35f62da935a8bfb903a18a726c))
* libraries/grpc-sdk/package.json to reduce vulnerabilities ([#667](https://github.com/ConduitPlatform/Conduit/issues/667)) ([f4564a2](https://github.com/ConduitPlatform/Conduit/commit/f4564a251a1d619fd9bc1cb1bbf793ffdd68b9f9))

## [0.16.0-alpha.18](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.17...v0.16.0-alpha.18) (2023-07-19)

## [0.16.0-alpha.17](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.16...v0.16.0-alpha.17) (2023-07-19)


### Features

* **storage:** authorization integration ([#661](https://github.com/ConduitPlatform/Conduit/issues/661)) ([008b81e](https://github.com/ConduitPlatform/Conduit/commit/008b81e9f0d6f747c44a48a258b027374123707d))


### Bug Fixes

* **database:** fix types in mongoose ([#662](https://github.com/ConduitPlatform/Conduit/issues/662)) ([818be97](https://github.com/ConduitPlatform/Conduit/commit/818be97e77331c30193a2e941ed954e7dfb41fa7))

## [0.16.0-alpha.16](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.15...v0.16.0-alpha.16) (2023-07-13)


### Features

* **authentication,grpc-sdk:** getTeam, createTeam gRPC methods ([#659](https://github.com/ConduitPlatform/Conduit/issues/659)) ([d7b686e](https://github.com/ConduitPlatform/Conduit/commit/d7b686e0844e99b5eddc041c05eef9cb647b2ad5))
* **authentication:** pass user object to magicLink email template ([#651](https://github.com/ConduitPlatform/Conduit/issues/651)) ([15022d4](https://github.com/ConduitPlatform/Conduit/commit/15022d497e5a49b1d542dfb8ee5dc02b36c785c9))


### Bug Fixes

* **authentication:** case-sensitive User.email queries ([#649](https://github.com/ConduitPlatform/Conduit/issues/649)) ([938d45a](https://github.com/ConduitPlatform/Conduit/commit/938d45a0ab156c850c372ee7fa0fef2a27d617fe))
* **authentication:** emails are not always converted to lowercase before storing ([#648](https://github.com/ConduitPlatform/Conduit/issues/648)) ([810cf4f](https://github.com/ConduitPlatform/Conduit/commit/810cf4fdd24c73ca43bb812ea0aae825f13b5efb))
* **authentication:** magic link hook verificationToken url param ([#647](https://github.com/ConduitPlatform/Conduit/issues/647)) ([9d3d902](https://github.com/ConduitPlatform/Conduit/commit/9d3d902ffb283b834ce9a076c4ece43d0f1442d6))
* **authentication:** refresh tokens not being deleted on logout ([#650](https://github.com/ConduitPlatform/Conduit/issues/650)) ([0f40412](https://github.com/ConduitPlatform/Conduit/commit/0f40412b6ac822835726beff0aadef5497df0397))
* **database:** excluded fields ignored when not using select ([#653](https://github.com/ConduitPlatform/Conduit/issues/653)) ([032701c](https://github.com/ConduitPlatform/Conduit/commit/032701cd78bc9cef13a55de04fb0cadd15726426))
* **database:** paginating/sorting on findMany twice, causing data issues ([a5bf9da](https://github.com/ConduitPlatform/Conduit/commit/a5bf9da51143dd794131a40f8fe4f8cec1835d06))
* **database:** sorting not triggering after view ([988482f](https://github.com/ConduitPlatform/Conduit/commit/988482f6489eeabc4a00ac3c7a616d1a742374f3))
* **email:** email template model subject/body field sql size ([#652](https://github.com/ConduitPlatform/Conduit/issues/652)) ([44a47dd](https://github.com/ConduitPlatform/Conduit/commit/44a47ddedc5b0de67d4892d61f8152898c2e33d3))
* libraries/grpc-sdk/package.json to reduce vulnerabilities ([#654](https://github.com/ConduitPlatform/Conduit/issues/654)) ([ef8fb00](https://github.com/ConduitPlatform/Conduit/commit/ef8fb00e8d5a356fe934f12d3910aa1a2a9905ed))
* **push-notifications:** base provider starting as not initialized ([25b612c](https://github.com/ConduitPlatform/Conduit/commit/25b612c010f24337174da0ed07aff1d14122df62))
* **push-notifications:** base provider trying to fetch tokens ([5f751eb](https://github.com/ConduitPlatform/Conduit/commit/5f751eb8346e1ae49a509dc7c11d867e10e8f258))

## [0.16.0-alpha.15](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.14...v0.16.0-alpha.15) (2023-06-27)

## [0.16.0-alpha.14](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.13...v0.16.0-alpha.14) (2023-06-26)


### Features

* **push-notification:** support data-only silent messages ([#645](https://github.com/ConduitPlatform/Conduit/issues/645)) ([321da9c](https://github.com/ConduitPlatform/Conduit/commit/321da9c1823d7624f5881a2afee69d96e21ca196))
* **sms:** AWS, ClickSend, MessageBird providers ([#633](https://github.com/ConduitPlatform/Conduit/issues/633)) ([f3ee5c5](https://github.com/ConduitPlatform/Conduit/commit/f3ee5c5a7b008fdb2a3a462f65064d0a406a4872))


### Bug Fixes

* **authentication,sms:** hash sms phone numbers & fix bugs in authenticate() ([#644](https://github.com/ConduitPlatform/Conduit/issues/644)) ([66ec17f](https://github.com/ConduitPlatform/Conduit/commit/66ec17f9160f5cffeb5d0421ab294480341303f0))
* **authentication:** getTeam checks not working correctly ([c0ef200](https://github.com/ConduitPlatform/Conduit/commit/c0ef20097859311cdc970cebf3504e5b3d56e062))
* **authentication:** token fetching in logout ([ba7f1fd](https://github.com/ConduitPlatform/Conduit/commit/ba7f1fd0c7e7d8558e6d97623d464bf4d1f87316))
* **authorization:** not registering routes ([686ed43](https://github.com/ConduitPlatform/Conduit/commit/686ed43de82bffd6e2e5fb5071f258d9b989f8e7))
* broken readme markdown ([1bf1f56](https://github.com/ConduitPlatform/Conduit/commit/1bf1f5686570e2d46b273b9beba137c69a3c2d32))
* **database:** correct typos ([#641](https://github.com/ConduitPlatform/Conduit/issues/641)) ([b9d7fdc](https://github.com/ConduitPlatform/Conduit/commit/b9d7fdcc8798a5994bbc351fc1a3068444158fb5))
* **database:** missing optional operator for authorization checks ([8df90ba](https://github.com/ConduitPlatform/Conduit/commit/8df90bab0ae77ebcef4d4b1e4ce861d39429e9e1))
* **database:** missing permission inheritance for reader/editor roles ([1904ed7](https://github.com/ConduitPlatform/Conduit/commit/1904ed703d7791f6e505de067291bab9fe542a3b))
* **database:** populate failing in mongo when in subpath ([8f855c9](https://github.com/ConduitPlatform/Conduit/commit/8f855c9c450fbdfbb02c259dc43eccc70398b576))
* **database:** trying to create view even when not required ([4112c2b](https://github.com/ConduitPlatform/Conduit/commit/4112c2b66352e9d304fa3126e98148c489ec6b30))

## [0.16.0-alpha.13](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.12...v0.16.0-alpha.13) (2023-06-12)


### Features

* **authorization:** client routes to check permissions and roles for user ([289051d](https://github.com/ConduitPlatform/Conduit/commit/289051d0350044843d8a5450ac35b11c9f4e6441))
* **database:** enable authorized schema support ([#632](https://github.com/ConduitPlatform/Conduit/issues/632)) ([6c0cb4b](https://github.com/ConduitPlatform/Conduit/commit/6c0cb4b1a4614456f85961377bbfaba90bcf8248))
* **functions:** webhook,event,socket,middlware functions support ([#609](https://github.com/ConduitPlatform/Conduit/issues/609)) ([fce847b](https://github.com/ConduitPlatform/Conduit/commit/fce847b2023d2f82f7cb2661d0b4d05370444add))


### Bug Fixes

* **authentication:** user logout not working with cookies ([3927275](https://github.com/ConduitPlatform/Conduit/commit/3927275aa091418530094fe2d5bb0fc81158525f))
* **grpc-sdk:** conduitQueryParams type disallowing required object-formatted array param definition ([#640](https://github.com/ConduitPlatform/Conduit/issues/640)) ([6d09cd9](https://github.com/ConduitPlatform/Conduit/commit/6d09cd9dd12dd398f8efe319e5d90d64181c4f8c))
* modules/storage/package.json to reduce vulnerabilities ([#634](https://github.com/ConduitPlatform/Conduit/issues/634)) ([7adb9b5](https://github.com/ConduitPlatform/Conduit/commit/7adb9b57ad414fe1984e142490b791bbff316774))
* **storage:** build failing due to aws lib version mismatch ([#639](https://github.com/ConduitPlatform/Conduit/issues/639)) ([37e5417](https://github.com/ConduitPlatform/Conduit/commit/37e541704dc032eaedd89d16413c494720e48c71))

## [0.16.0-alpha.12](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.11...v0.16.0-alpha.12) (2023-05-26)


### Features

* **storage:** recursive folder creation ([#628](https://github.com/ConduitPlatform/Conduit/issues/628)) ([22e3ed7](https://github.com/ConduitPlatform/Conduit/commit/22e3ed71553f924004e4082a4326f1f72ae60562))
* teamDelete auth rpc & grpcToParsedRouterRequest helper ([#629](https://github.com/ConduitPlatform/Conduit/issues/629)) ([62b0640](https://github.com/ConduitPlatform/Conduit/commit/62b06401ed531d37438d78fa17e20826a64b77e1))


### Bug Fixes

* **database:** array populate issues ([b047c6a](https://github.com/ConduitPlatform/Conduit/commit/b047c6a287bfc0b46f41bf3db15fa94849cbc760))
* **storage:** param adapter not working correctly for getFileByUrl ([144bc10](https://github.com/ConduitPlatform/Conduit/commit/144bc10d7342ee218204d9166dced32671f68839))

## [0.16.0-alpha.11](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.10...v0.16.0-alpha.11) (2023-05-18)


### Bug Fixes

* **functions,sms:** admin route registration before module registration errors ([#625](https://github.com/ConduitPlatform/Conduit/issues/625)) ([a456511](https://github.com/ConduitPlatform/Conduit/commit/a456511e620c84dfb15792901f133391150dcea9))

## [0.16.0-alpha.10](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.9...v0.16.0-alpha.10) (2023-05-18)


### Bug Fixes

* **module-tools:** db losing connection when restarting router ([#620](https://github.com/ConduitPlatform/Conduit/issues/620)) ([fec2e03](https://github.com/ConduitPlatform/Conduit/commit/fec2e03b32814936609773d04627d360de43bf02))

## [0.16.0-alpha.9](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.8...v0.16.0-alpha.9) (2023-05-10)


### ⚠ BREAKING CHANGES

* **database:** re-work sql schema objects & relations (#573)

### Features

* **admin,router,hermes,grpc-sdk,core:** middleware patch support ([#614](https://github.com/ConduitPlatform/Conduit/issues/614)) ([8d19469](https://github.com/ConduitPlatform/Conduit/commit/8d194693a0250a3e093f3d8976009bc1f5793df4))


### Bug Fixes

* **authentication:** tokens set with wrong expiry on  JWT and Cookies ([#616](https://github.com/ConduitPlatform/Conduit/issues/616)) ([db60991](https://github.com/ConduitPlatform/Conduit/commit/db6099191f2767524715e317db4a424db1ff0958))
* **authentication:** user id matching on oauth2 ([55ad75e](https://github.com/ConduitPlatform/Conduit/commit/55ad75ee2f463456bfba0ca76f377b3f196438af))
* **database:** association update using wrong name ([e9d8c2b](https://github.com/ConduitPlatform/Conduit/commit/e9d8c2b3a09b6441091b564d2dcbbdfb77e6170c))
* **database:** checking wrong foreignKey name for m:m relations ([bf5a664](https://github.com/ConduitPlatform/Conduit/commit/bf5a66496da864fe913577ba6234ba60ce5b26eb))
* **database:** cms schema query ([5df94d7](https://github.com/ConduitPlatform/Conduit/commit/5df94d749df285e4fd13dc69231eebf6535685b7))
* **database:** embedded schema/relation extractors parsing issues ([5db438b](https://github.com/ConduitPlatform/Conduit/commit/5db438bdb48786e33401f4ee680d0ece819a02cb))
* **database:** fix custom endpoints check ([#618](https://github.com/ConduitPlatform/Conduit/issues/618)) ([a05fae1](https://github.com/ConduitPlatform/Conduit/commit/a05fae13dcca10fd74ee97b361d9b87afec90901))
* **database:** getSchemas not discriminating against extracted schemas ([c91e79b](https://github.com/ConduitPlatform/Conduit/commit/c91e79bbb7e081144e2b69c1c32f65ddb63c3695))
* **database:** issues when creating associations that contain relations ([6254da2](https://github.com/ConduitPlatform/Conduit/commit/6254da284814d3887e9226af366cb17d69177083))
* **database:** parentSchema check in db not detailed enough ([d544262](https://github.com/ConduitPlatform/Conduit/commit/d544262d7dbbd5cd2d85dc42a23e2b5e0d1ff5e2))
* **database:** populating parentDoc in findByIdAndUpdate without it being needed ([#613](https://github.com/ConduitPlatform/Conduit/issues/613)) ([eea6f25](https://github.com/ConduitPlatform/Conduit/commit/eea6f250fe1d2ef5f9145f7136711dd65d67614a))
* **database:** setting associations ([58ae1f6](https://github.com/ConduitPlatform/Conduit/commit/58ae1f66baaebcb5e8b2ec224c35d33d1bb6f96d))
* **database:** support $in & $nin operators for all sql dialects ([#608](https://github.com/ConduitPlatform/Conduit/issues/608)) ([2b77446](https://github.com/ConduitPlatform/Conduit/commit/2b774461653255e02322a6596841de48e4250294))
* **email:** smtp settings ([8ce071d](https://github.com/ConduitPlatform/Conduit/commit/8ce071da47ec44721c0e6dfaa5d20bd280881031))
* **email:** smtp settings ([460785a](https://github.com/ConduitPlatform/Conduit/commit/460785ad1162cf5c56e32636df6533895f1ccbb4))
* gh action release version injection ([a29b750](https://github.com/ConduitPlatform/Conduit/commit/a29b75068b549426228c72e6b1eae393a903345e))
* **hermes:** dependency issues with socket.io update ([88888e2](https://github.com/ConduitPlatform/Conduit/commit/88888e28f73602ec86b484ac673992b5bcbdb4c9))
* **storage:** createFileByUrl/updateFileByUrl gRPC size types ([#607](https://github.com/ConduitPlatform/Conduit/issues/607)) ([abfd638](https://github.com/ConduitPlatform/Conduit/commit/abfd6389f8623629c4bde890a08402e6145bbfb9))


* **database:** re-work sql schema objects & relations ([#573](https://github.com/ConduitPlatform/Conduit/issues/573)) ([de5851d](https://github.com/ConduitPlatform/Conduit/commit/de5851dd8f1d28fc54167fbaccc7fe3fe775e088))

## [0.16.0-alpha.8](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.7...v0.16.0-alpha.8) (2023-04-24)


### Features

* **authentication:** add cleanup code to delete expired refresh/access tokens ([#602](https://github.com/ConduitPlatform/Conduit/issues/602)) ([dae18ea](https://github.com/ConduitPlatform/Conduit/commit/dae18ea1adc0e9671ca89b1a6037c708125768f8))
* module-tools publishing ([#606](https://github.com/ConduitPlatform/Conduit/issues/606)) ([ebc9d89](https://github.com/ConduitPlatform/Conduit/commit/ebc9d89f794f9f3da6f78bd243e5b01d67a1faeb))


### Bug Fixes

* **database:** adding/removing object(group) fields not working ([#603](https://github.com/ConduitPlatform/Conduit/issues/603)) ([1134f4b](https://github.com/ConduitPlatform/Conduit/commit/1134f4bbe5aa032f3eb92c98066952c38574e3bb))

## [0.16.0-alpha.7](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.6...v0.16.0-alpha.7) (2023-04-21)


### ⚠ BREAKING CHANGES

* **database:** wrong foreign key names (#599)

### Bug Fixes

* **authentication:** provider email/id matching not working properly ([#601](https://github.com/ConduitPlatform/Conduit/issues/601)) ([4f34ea9](https://github.com/ConduitPlatform/Conduit/commit/4f34ea9b239086f79dbb1e0362a0891992d83233))
* **database:** exportCustomEndpoints() returning schema ids ([#598](https://github.com/ConduitPlatform/Conduit/issues/598)) ([484e2f1](https://github.com/ConduitPlatform/Conduit/commit/484e2f14e5f669184369b258a29b8426fb43687d))
* **database:** wrong foreign key names ([#599](https://github.com/ConduitPlatform/Conduit/issues/599)) ([1b8c422](https://github.com/ConduitPlatform/Conduit/commit/1b8c42289ceff8190cde2616e72669ea0ed4fcd1))
* github actions ([918020c](https://github.com/ConduitPlatform/Conduit/commit/918020c31fac9a7f289a1ccd472322cf35c3f363))

## [0.16.0-alpha.6](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.4...v0.16.0-alpha.6) (2023-04-19)


### Features

* **authentication:** custom redirect uri config option ([#589](https://github.com/ConduitPlatform/Conduit/issues/589)) ([62965b2](https://github.com/ConduitPlatform/Conduit/commit/62965b2b4610d704fe28ddd396942db951944aed))


### Bug Fixes

* **authentication:** crash on setConfig due to old properties ([#588](https://github.com/ConduitPlatform/Conduit/issues/588)) ([b23ffc4](https://github.com/ConduitPlatform/Conduit/commit/b23ffc4384ba1b869d4f2c5b7a3518def9ad1e8a))
* **authentication:** team permissions allowance check ([6cac5ba](https://github.com/ConduitPlatform/Conduit/commit/6cac5badeea28e255821479f73444dcb47b841b7))
* **authentication:** user is able to pass auth middleware when blocked ([#594](https://github.com/ConduitPlatform/Conduit/issues/594)) ([b544180](https://github.com/ConduitPlatform/Conduit/commit/b54418046875e1e6298b3674ae4d56e9e6f10d6f))
* **database:** mongo aggregation not returning documents properly ([6c759d6](https://github.com/ConduitPlatform/Conduit/commit/6c759d6c411fa66cc455f52ef25e40b5f203d0af))
* **database:** sql like/ilike customEndpoint queries regexp escaping ([#596](https://github.com/ConduitPlatform/Conduit/issues/596)) ([9625f2b](https://github.com/ConduitPlatform/Conduit/commit/9625f2b1af09a115a454a6a152665b1721b70010))
* **grpc-sdk:** readme ([06658e0](https://github.com/ConduitPlatform/Conduit/commit/06658e0c02f220977f716dc88fc144648c671194))
* **storage:** correction of check in validation  ([#584](https://github.com/ConduitPlatform/Conduit/issues/584)) ([35b706b](https://github.com/ConduitPlatform/Conduit/commit/35b706ba91491dbb9aff3615665bf23a0838c819))

## [0.16.0-alpha.4](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.3...v0.16.0-alpha.4) (2023-04-07)


### Features

* **authentication, router,forms:** global captcha support from router ([#580](https://github.com/ConduitPlatform/Conduit/issues/580)) ([24b4b81](https://github.com/ConduitPlatform/Conduit/commit/24b4b8177c60c6a033291b0e49a94128b116413e))
* **authentication,core:** add register invitation config option & fix addFieldsToModule ([#579](https://github.com/ConduitPlatform/Conduit/issues/579)) ([0132c61](https://github.com/ConduitPlatform/Conduit/commit/0132c61de777481a387dfeb6c7567ece37b557b8))


### Bug Fixes

* **authentication:** team invite not requiring role and email ([2261590](https://github.com/ConduitPlatform/Conduit/commit/226159037dc82235a9513eb6d799728507180760))
* **grpc-sdk,email:** result parsing & template model subject requirement ([#581](https://github.com/ConduitPlatform/Conduit/issues/581)) ([8b6d2fa](https://github.com/ConduitPlatform/Conduit/commit/8b6d2fadd04d31e4cae1bdcfb5cea32023d96c0c))
* **router:** relation handling ([ef84def](https://github.com/ConduitPlatform/Conduit/commit/ef84def11b5e55c4feea31cbfcc49372e6476494))
* **storage,grpc-sdk:** fix storage rpc functions ([#583](https://github.com/ConduitPlatform/Conduit/issues/583)) ([c799c5d](https://github.com/ConduitPlatform/Conduit/commit/c799c5d890f2874fb38c74e983d52afe189d40f0))

## [0.16.0-alpha.3](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.2...v0.16.0-alpha.3) (2023-03-31)


### Bug Fixes

* **grpc-sdk:** logger crashing on read-only directories ([27315f5](https://github.com/ConduitPlatform/Conduit/commit/27315f5f1a0b75406cf17f0f7053caf0bb09927a))

## [0.16.0-alpha.2](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.1...v0.16.0-alpha.2) (2023-03-30)


### Features

* **grpc-sdk:** url remap object config ([#577](https://github.com/ConduitPlatform/Conduit/issues/577)) ([289b74a](https://github.com/ConduitPlatform/Conduit/commit/289b74a9396d341e32561f8ca04907f41429feec))


### Bug Fixes

* **database:** add modelOptions timestamps ([#576](https://github.com/ConduitPlatform/Conduit/issues/576)) ([bcf144c](https://github.com/ConduitPlatform/Conduit/commit/bcf144c51d6e36aa47867e0fb9c6edaf86b4c240))
* **database:** custom endpoint creation issue with residual commas ([#575](https://github.com/ConduitPlatform/Conduit/issues/575)) ([089f699](https://github.com/ConduitPlatform/Conduit/commit/089f6992ed4317681db285c7710e564739a35945))
* **database:** customEndpoint create string comma issue ([b93dc20](https://github.com/ConduitPlatform/Conduit/commit/b93dc20f9cf48795a6189f175f8b4442141dd2bf))
* **router,admin:** cache-control missing from default allowed headers ([6647c15](https://github.com/ConduitPlatform/Conduit/commit/6647c15f1aa4bb11e5fc0674b84af42afac0b1b0))
* **router:** validateObject in array ([b491689](https://github.com/ConduitPlatform/Conduit/commit/b491689dfddc979636e7265c0ee0a028de923212))

## [0.16.0-alpha.1](https://github.com/ConduitPlatform/Conduit/compare/v0.16.0-alpha.0...v0.16.0-alpha.1) (2023-03-27)


### ⚠ BREAKING CHANGES

* **storage:** add file upload/update by url instead of base64 (#550)

### Features

* **authentication:** add populate option in team requests ([#574](https://github.com/ConduitPlatform/Conduit/issues/574)) ([07357ff](https://github.com/ConduitPlatform/Conduit/commit/07357ff441d0b3874717046d73bcdd4661d29e67))
* **authentication:** expand teams functionality ([#554](https://github.com/ConduitPlatform/Conduit/issues/554)) ([25733bb](https://github.com/ConduitPlatform/Conduit/commit/25733bb725f0f126e88f15e1bc0e9904eee9d58c))
* **authentication:** getTeams allows search by parent team ([0f29c54](https://github.com/ConduitPlatform/Conduit/commit/0f29c5486b13efc66a38b2d7cf78d5ee6ef2ba2a))
* **authentication:** getTeams shows only parentTeams when param is not provided ([19637ae](https://github.com/ConduitPlatform/Conduit/commit/19637ae56f5dfafe392206043cfb7028eae5f584))
* **database:** column existence operation ([#537](https://github.com/ConduitPlatform/Conduit/issues/537)) ([d784f40](https://github.com/ConduitPlatform/Conduit/commit/d784f4082ad6cfb71e12bdf7230ab88d6a57e7a1))
* **database:** import & export for custom schemas & endpoints ([#549](https://github.com/ConduitPlatform/Conduit/issues/549)) ([e179719](https://github.com/ConduitPlatform/Conduit/commit/e179719dc1d804bb469a92f76e2e75e41e3fb756))
* **grpc-sdk:** add router type to logs to distinguish admin/client requests ([#564](https://github.com/ConduitPlatform/Conduit/issues/564)) ([3978c99](https://github.com/ConduitPlatform/Conduit/commit/3978c99dbf5bd6833b14837111cbc5c84cfba12f))
* sql data types ([#547](https://github.com/ConduitPlatform/Conduit/issues/547)) ([9a54104](https://github.com/ConduitPlatform/Conduit/commit/9a5410442e8ab326a8bbeefb8adfdf5d8f26a1e6))
* **storage:** add file upload/update by url instead of base64 ([#550](https://github.com/ConduitPlatform/Conduit/issues/550)) ([8b32a8e](https://github.com/ConduitPlatform/Conduit/commit/8b32a8e2f1e8657257c41c3cbbe585be3293f000))


### Bug Fixes

* **admin, router:** proxyRoutes model ([#535](https://github.com/ConduitPlatform/Conduit/issues/535)) ([179a061](https://github.com/ConduitPlatform/Conduit/commit/179a0614eebdbe68c45c7ca675da013dca104778))
* **authentication:** accessTokens being set wrongly when cookies are enabled ([5afd5ca](https://github.com/ConduitPlatform/Conduit/commit/5afd5ca0f1f17f8c6d4c4b3037a48804b4cc567c))
* **authentication:** add better check for parentTeam missing ([9dc016d](https://github.com/ConduitPlatform/Conduit/commit/9dc016dfb3ddeb02530592033fb7e6e19a6c3583))
* **authentication:** get team members admin query using wrong query ([#569](https://github.com/ConduitPlatform/Conduit/issues/569)) ([4ad588c](https://github.com/ConduitPlatform/Conduit/commit/4ad588c7e97cc4bce2b5520310521d9a09a5373b))
* **authentication:** get teams params registered as url ([9cde224](https://github.com/ConduitPlatform/Conduit/commit/9cde22456d05902d225f584a0f9fb980df2efaa8))
* **authentication:** module not removing deprecated config ([#560](https://github.com/ConduitPlatform/Conduit/issues/560)) ([23e93c3](https://github.com/ConduitPlatform/Conduit/commit/23e93c3c9ccb79b842849799915f21db28f19e9d))
* **authentication:** remove $or from parent team ([2688ac0](https://github.com/ConduitPlatform/Conduit/commit/2688ac0aee561659cd6ba8c58c427c4345e8129a))
* **authentication:** remove older preConfig (hotfix) ([f6dc2d3](https://github.com/ConduitPlatform/Conduit/commit/f6dc2d30ab767df7123a12933dc56851d8c934b7))
* **authentication:** skip/limit in team requests ([60b85ef](https://github.com/ConduitPlatform/Conduit/commit/60b85efe54dbe57d33e592db05772a0fded7623e))
* **authentication:** teams admin handlers not being registered ([b575801](https://github.com/ConduitPlatform/Conduit/commit/b57580160506b0c1274a1840291be9b3e7c04a7d))
* **authentication:** teams schema ([eb1a4db](https://github.com/ConduitPlatform/Conduit/commit/eb1a4dbbbba88a512a0d9464a467eaa4e2195f9e))
* **authentication:** wrong field search in getTeamMembers ([a1c54d4](https://github.com/ConduitPlatform/Conduit/commit/a1c54d4232905588e93e34040fab3ae9410b4c7b))
* **database:** add cnd_ prefix check ([#570](https://github.com/ConduitPlatform/Conduit/issues/570)) ([641bcb6](https://github.com/ConduitPlatform/Conduit/commit/641bcb6bbacf18f1c9943cb9761389b9ca6d7417))
* **database:** fix _id createdAt updatedAt format ([#567](https://github.com/ConduitPlatform/Conduit/issues/567)) ([947f64d](https://github.com/ConduitPlatform/Conduit/commit/947f64d5c2f72e0def6a2debe56c011e7037d262))
* **database:** fix mongoose & sequelize parseQuery & query param types ([#548](https://github.com/ConduitPlatform/Conduit/issues/548)) ([a7510f6](https://github.com/ConduitPlatform/Conduit/commit/a7510f6e4957d60c3d36d994420c75ad3f156e98))
* **database:** fix sort query param format ([#530](https://github.com/ConduitPlatform/Conduit/issues/530)) ([c401935](https://github.com/ConduitPlatform/Conduit/commit/c401935774d18e9f0110fb566a77f96e040333b9))
* **database:** fix sql findByIdAndUpdate associations ([#561](https://github.com/ConduitPlatform/Conduit/issues/561)) ([8eac300](https://github.com/ConduitPlatform/Conduit/commit/8eac30085f62154e2ddeb8f4749800d76d76cd3a))
* **database:** jsonb sql datatype ([#541](https://github.com/ConduitPlatform/Conduit/issues/541)) ([9e34532](https://github.com/ConduitPlatform/Conduit/commit/9e34532c3d84cca46fcbaa9cc547e30e679669ac))
* **database:** mongo not recovering schemas ([339ab08](https://github.com/ConduitPlatform/Conduit/commit/339ab0854ba5df2b57aae1f26de3af30635f7aa4))
* **database:** mongo parser removing regex queries ([f0cfb8b](https://github.com/ConduitPlatform/Conduit/commit/f0cfb8b51f9b94cdb8b181e44b4fe518a5096d9e))
* **database:** mongoose extractObjectType issue ([8db5088](https://github.com/ConduitPlatform/Conduit/commit/8db5088430debb7d6f99fc00f14b27a4f3364370))
* **database:** mongoose populations broken ([c01edcc](https://github.com/ConduitPlatform/Conduit/commit/c01edcc3d27bf3d4caab2dffc2f7f44b25bfcc8a))
* **database:** mongoose sync throws unnecessary error ([ddbc008](https://github.com/ConduitPlatform/Conduit/commit/ddbc008e3875221cc3a845ec324927247f33a412))
* **database:** relation in extensions and array handling ([#566](https://github.com/ConduitPlatform/Conduit/issues/566)) ([bc3e546](https://github.com/ConduitPlatform/Conduit/commit/bc3e5469007379ca9239bd7f5261cd0e515efcec))
* **database:** schemas not being stored ([#538](https://github.com/ConduitPlatform/Conduit/issues/538)) ([adf8717](https://github.com/ConduitPlatform/Conduit/commit/adf87170cfdcf54da2b90d32f75ceacf2f8b0516))
* **database:** sequelize nested populations ([#546](https://github.com/ConduitPlatform/Conduit/issues/546)) ([904714a](https://github.com/ConduitPlatform/Conduit/commit/904714a2b7b70b47e7ea8eaf3b48a4c54e393c09))
* **database:** some fixes for import & export ([#556](https://github.com/ConduitPlatform/Conduit/issues/556)) ([3ba5daf](https://github.com/ConduitPlatform/Conduit/commit/3ba5daf2329aa398d597eddfe885dacb316ef1a2))
* **database:** sqlite and general sql recovery issues ([#534](https://github.com/ConduitPlatform/Conduit/issues/534)) ([20f046a](https://github.com/ConduitPlatform/Conduit/commit/20f046a3303771dff895aa83588b842947748022))
* **database:** validate extension fields & customEndpoint export output ([#571](https://github.com/ConduitPlatform/Conduit/issues/571)) ([2438f33](https://github.com/ConduitPlatform/Conduit/commit/2438f33ae135aef3c7125fcb0d3d975a05d0af40))
* duplication, ts-ignore, any types ([#533](https://github.com/ConduitPlatform/Conduit/issues/533)) ([465b35e](https://github.com/ConduitPlatform/Conduit/commit/465b35e16ccc1548e0f11b08a08e95db4cf48c5a))
* duplication, unused vars, any types ([#531](https://github.com/ConduitPlatform/Conduit/issues/531)) ([ac02c13](https://github.com/ConduitPlatform/Conduit/commit/ac02c13adcd437862581a5bfd661a36e03a27491))
* **grpc-sdk:** latency metrics (hotfix) ([ed8bc0b](https://github.com/ConduitPlatform/Conduit/commit/ed8bc0bf2b1125dffd60536572d740498ff11c57))
* **hermes,database:** array validation for array types ([#568](https://github.com/ConduitPlatform/Conduit/issues/568)) ([105381a](https://github.com/ConduitPlatform/Conduit/commit/105381afbf557c2481056ed6a365e94ae97f72fc))
* **hermes:** GraphQL not respecting cache header ([#558](https://github.com/ConduitPlatform/Conduit/issues/558)) ([956eb32](https://github.com/ConduitPlatform/Conduit/commit/956eb32caff5b509975f3cc6e113bd4dd7692ab7))
* **hermes:** graphql population detection ([#536](https://github.com/ConduitPlatform/Conduit/issues/536)) ([fda8edc](https://github.com/ConduitPlatform/Conduit/commit/fda8edcea8c6ae13babc61c608255c11cd8d83ca))
* **hermes:** missing undefined handling for arrays ([2566cb5](https://github.com/ConduitPlatform/Conduit/commit/2566cb5a19fc59f740b9c3e01f8b977a800fd86c))
* **storage:** fix custom import of introspected/imported schemas ([#557](https://github.com/ConduitPlatform/Conduit/issues/557)) ([d36e15c](https://github.com/ConduitPlatform/Conduit/commit/d36e15cd17ed3e3937bd83265da6dbb35c9f21b7))
* **storage:** missed aws-sdk dependency ([c3ea3bd](https://github.com/ConduitPlatform/Conduit/commit/c3ea3bde413c5065dc8a535fc64a491af35681fd))
* **storage:** wrong return signature on upload by url ([#565](https://github.com/ConduitPlatform/Conduit/issues/565)) ([0f8d9ed](https://github.com/ConduitPlatform/Conduit/commit/0f8d9ed0872b3211b79d5a172c7a1393e743288e))

## [0.16.0-alpha.0](https://github.com/ConduitPlatform/Conduit/compare/v0.15.14...v0.16.0-alpha.0) (2023-02-20)


### ⚠ BREAKING CHANGES

* **database:** re-work SQL support (#492)

### Features

* **database:** duplication and code refactoring ([#519](https://github.com/ConduitPlatform/Conduit/issues/519)) ([6856ede](https://github.com/ConduitPlatform/Conduit/commit/6856ede55ee27f94fbaf2c8da52c6d7187f82ff9))
* **router, admin, hermes, grpc-sdk:** proxy routes support ([#488](https://github.com/ConduitPlatform/Conduit/issues/488)) ([9b76974](https://github.com/ConduitPlatform/Conduit/commit/9b769742dbeceb4f19c08e2707a8ee5a5d8d83f2))


### Bug Fixes

* **authorization:** missing type for delete resource/relation ([#520](https://github.com/ConduitPlatform/Conduit/issues/520)) ([fc44213](https://github.com/ConduitPlatform/Conduit/commit/fc442135dbb6740f07dbb08cdce9f86a0f8996ae))
* **database:** admin createSchema() invalid id,createdAt,updatedAt field constraints ([#511](https://github.com/ConduitPlatform/Conduit/issues/511)) ([4ddea48](https://github.com/ConduitPlatform/Conduit/commit/4ddea48e0d12dc6fbe6d78d54fa8b643d1dbf564))
* **database:** admin schema creation adding explicit primaryKey ([#522](https://github.com/ConduitPlatform/Conduit/issues/522)) ([a5ee620](https://github.com/ConduitPlatform/Conduit/commit/a5ee620b4131656253cb2d7bb4f880baffba4d71))
* **database:** ambiguous SQL like/ilike query fields ([#518](https://github.com/ConduitPlatform/Conduit/issues/518)) ([47abfaa](https://github.com/ConduitPlatform/Conduit/commit/47abfaaf341b93525c14397c4f1d2056049fe2e9))
* **database:** findByIdAndUpdate crashing when storing embedded documents ([#528](https://github.com/ConduitPlatform/Conduit/issues/528)) ([ec97366](https://github.com/ConduitPlatform/Conduit/commit/ec973661a5510837e50b04811bc4d6208c37ae25))
* **database:** relation issues ([#517](https://github.com/ConduitPlatform/Conduit/issues/517)) ([e8f1cdc](https://github.com/ConduitPlatform/Conduit/commit/e8f1cdcb935a23bac2e1fa9f8f8a7dcf23769d7d))
* **database:** relationObjects ([#513](https://github.com/ConduitPlatform/Conduit/issues/513)) ([9b3a353](https://github.com/ConduitPlatform/Conduit/commit/9b3a353145cea77afaf276caa31f62b8cc563d3c))
* **database:** wrong legacyCollections comment-out ([#527](https://github.com/ConduitPlatform/Conduit/issues/527)) ([bddab3c](https://github.com/ConduitPlatform/Conduit/commit/bddab3cb899eec9a1d1cc04f90213cc2e0c3ee20))
* **grpc-sdk:** add missing collectionName in getSchema(s) database grpc-sdk wrapper ([#525](https://github.com/ConduitPlatform/Conduit/issues/525)) ([8f18212](https://github.com/ConduitPlatform/Conduit/commit/8f18212cb4bc6cf0062099b0f953bbd7236fcfc8))
* **hermes,grpc-sdk,authentication:** redirect requests not setting cookies, invalid setCookies format ([#514](https://github.com/ConduitPlatform/Conduit/issues/514)) ([453c956](https://github.com/ConduitPlatform/Conduit/commit/453c956e2b1fdfc9ae4c9b5734e6eca3ce425e37))
* **push-notifications:** expecting string instead of JSON in send admin requests ([#521](https://github.com/ConduitPlatform/Conduit/issues/521)) ([0a62623](https://github.com/ConduitPlatform/Conduit/commit/0a62623331a9c010ce26076356f971cf7015cfd1))
* **push-notifications:** param read in getNotifications not working when false ([#526](https://github.com/ConduitPlatform/Conduit/issues/526)) ([c036871](https://github.com/ConduitPlatform/Conduit/commit/c036871ef9791785041d97a4b0b9c12a95b8c7ef))
* **storage:** public url not updated when updating file properties ([#516](https://github.com/ConduitPlatform/Conduit/issues/516)) ([f3cbdfe](https://github.com/ConduitPlatform/Conduit/commit/f3cbdfe3276d37399566e008713cad15f97cc2b0))


* **database:** re-work SQL support ([#492](https://github.com/ConduitPlatform/Conduit/issues/492)) ([c833e2f](https://github.com/ConduitPlatform/Conduit/commit/c833e2fc0024a1ac1ec846535134cb7a675fc60b))

### [0.15.14](https://github.com/ConduitPlatform/Conduit/compare/v0.15.13...v0.15.14) (2023-02-09)


### Features

* **push-notifications:** add a notifications center ([#506](https://github.com/ConduitPlatform/Conduit/issues/506)) ([38e2f56](https://github.com/ConduitPlatform/Conduit/commit/38e2f566130382719e0b88d8685578834a1ab510))


### Bug Fixes

* **push-notifications:** notifications count query being modified ([#507](https://github.com/ConduitPlatform/Conduit/issues/507)) ([31d297e](https://github.com/ConduitPlatform/Conduit/commit/31d297e5fce30ee6304aa87131e630e47d183354))

### [0.15.13](https://github.com/ConduitPlatform/Conduit/compare/v0.15.12...v0.15.13) (2023-02-02)


### Bug Fixes

* **database:** delete indexes route param type ([#501](https://github.com/ConduitPlatform/Conduit/issues/501)) ([8b4831e](https://github.com/ConduitPlatform/Conduit/commit/8b4831e128d585eccff308e6e5578101cdd832ba))

### [0.15.12](https://github.com/ConduitPlatform/Conduit/compare/v0.15.11...v0.15.12) (2023-02-02)


### Bug Fixes

* **database:** object comparison failing due to wrong check ([#502](https://github.com/ConduitPlatform/Conduit/issues/502)) ([fb525eb](https://github.com/ConduitPlatform/Conduit/commit/fb525eb06062e4614038e4bc8cb3f9fbbeb21286))

### [0.15.11](https://github.com/ConduitPlatform/Conduit/compare/v0.15.10...v0.15.11) (2023-01-31)


### Features

* **storage:** make s3 storage generic with endpoint  fix [#497](https://github.com/ConduitPlatform/Conduit/issues/497) ([#498](https://github.com/ConduitPlatform/Conduit/issues/498)) ([331ae73](https://github.com/ConduitPlatform/Conduit/commit/331ae736ef20c28009e8879741eff7d9ae7f8115))


### Bug Fixes

* **database,grpc-sdk:** sql parseQuery numeric parsing, grpc-sdk depending on sequelize ([#500](https://github.com/ConduitPlatform/Conduit/issues/500)) ([6c58302](https://github.com/ConduitPlatform/Conduit/commit/6c58302067b7ea7eb7d24d95c23da8472f2e5749))
* **database:** sequelize populates cache identifier uniqueness ([#489](https://github.com/ConduitPlatform/Conduit/issues/489)) ([a37d388](https://github.com/ConduitPlatform/Conduit/commit/a37d38813fc91b15c3d20542a96c22933cb0ceb6))
* **hermes:** numeric param parsing, REST middleware running before param validation ([#491](https://github.com/ConduitPlatform/Conduit/issues/491)) ([d0cff88](https://github.com/ConduitPlatform/Conduit/commit/d0cff8842d578367b215d195e408db052b8393b5))
* migrations ([#493](https://github.com/ConduitPlatform/Conduit/issues/493)) ([c01cb16](https://github.com/ConduitPlatform/Conduit/commit/c01cb16bc7fae7cd9c6affa7e039db164ffc4f64))

### [0.15.10](https://github.com/ConduitPlatform/Conduit/compare/v0.15.9...v0.15.10) (2023-01-13)


### Features

* **grpc-sdk:** add namespace label to loki for k8s ([#486](https://github.com/ConduitPlatform/Conduit/issues/486)) ([11c6e9b](https://github.com/ConduitPlatform/Conduit/commit/11c6e9b51a41b900244079502fe015ca7e8050d0))
* new Functions module ([#474](https://github.com/ConduitPlatform/Conduit/issues/474)) ([f7c874b](https://github.com/ConduitPlatform/Conduit/commit/f7c874b4348f370548ec5593a39b68d2908c2b5c))


### Bug Fixes

* **authentication:** OAuth2 authentication url construction ([#482](https://github.com/ConduitPlatform/Conduit/issues/482)) ([eae1e82](https://github.com/ConduitPlatform/Conduit/commit/eae1e8272817276da5b04622965bc2b41bdd9fed))
* **authentication:** undefined checks ([#481](https://github.com/ConduitPlatform/Conduit/issues/481)) ([3cfdf55](https://github.com/ConduitPlatform/Conduit/commit/3cfdf55c997607bb2a087c6c4973eeeb8d3e9101))
* get-conduit.sh not being posix compatible ([#485](https://github.com/ConduitPlatform/Conduit/issues/485)) ([d3f638e](https://github.com/ConduitPlatform/Conduit/commit/d3f638e71910ed03d5d88d959ef7620be424dd29))
* v10_15 migrations ([#487](https://github.com/ConduitPlatform/Conduit/issues/487)) ([cd37341](https://github.com/ConduitPlatform/Conduit/commit/cd373417f2f39bb877de8718a6670f1ba9e65a88))

### [0.15.9](https://github.com/ConduitPlatform/Conduit/compare/v0.15.8...v0.15.9) (2023-01-02)


### Features

* **authentication:** Captcha middleware with recaptcha v2 ([#467](https://github.com/ConduitPlatform/Conduit/issues/467)) ([e0286fb](https://github.com/ConduitPlatform/Conduit/commit/e0286fbd78b3e9c4eaaeb5ff049fedec317ecd49))
* **authentication:** Hcaptcha ([#470](https://github.com/ConduitPlatform/Conduit/issues/470)) ([efff1d0](https://github.com/ConduitPlatform/Conduit/commit/efff1d087dda8375a111c05419ab24f374c4fbfe))
* **core:** monolithic get config route ([#469](https://github.com/ConduitPlatform/Conduit/issues/469)) ([603690f](https://github.com/ConduitPlatform/Conduit/commit/603690fc3774264938f58410225908581c210018))


### Bug Fixes

* **authentication:** crash on postgres migrations ([#472](https://github.com/ConduitPlatform/Conduit/issues/472)) ([ea04506](https://github.com/ConduitPlatform/Conduit/commit/ea04506aed3ca109e28aa8c6e72ee21389cd20f1))
* **database:** sequelize populations ([#473](https://github.com/ConduitPlatform/Conduit/issues/473)) ([9a6ab79](https://github.com/ConduitPlatform/Conduit/commit/9a6ab791fef6ac66793de83d50fbb491ec50bc14))
* **database:** sequelize query sorting ([#480](https://github.com/ConduitPlatform/Conduit/issues/480)) ([a076852](https://github.com/ConduitPlatform/Conduit/commit/a0768526bd91024a1b698bb42d6c7d2eb78c1109))
* modules/push-notifications/package.json to reduce vulnerabilities ([#478](https://github.com/ConduitPlatform/Conduit/issues/478)) ([78d36ee](https://github.com/ConduitPlatform/Conduit/commit/78d36ee1322f67dec51249f34c1839fe18dcb5cb))

### [0.15.8](https://github.com/ConduitPlatform/Conduit/compare/v0.15.7...v0.15.8) (2022-12-16)


### Features

* **authentication:** teams & roles ([#411](https://github.com/ConduitPlatform/Conduit/issues/411)) ([921d68d](https://github.com/ConduitPlatform/Conduit/commit/921d68d251c84dcac54501401b771cfefbdea1b0))
* **database:** sort option in admin doc query ([741c128](https://github.com/ConduitPlatform/Conduit/commit/741c128d84d5780ad18cdee9c677ff6d7dad6ea8))
* expose compose container grpc ports ([#456](https://github.com/ConduitPlatform/Conduit/issues/456)) ([f9a6e3a](https://github.com/ConduitPlatform/Conduit/commit/f9a6e3aa6d1ad9ad2ca9f93a9b00d8acf0960709))
* get-conduit.sh --no-deploy flag ([#452](https://github.com/ConduitPlatform/Conduit/issues/452)) ([74d3833](https://github.com/ConduitPlatform/Conduit/commit/74d3833b100a7c613fb5bdf8cba2dc36d8f105d0))
* oneliner deployment setup for Linux and Mac ([#451](https://github.com/ConduitPlatform/Conduit/issues/451)) ([9838056](https://github.com/ConduitPlatform/Conduit/commit/9838056950fa560f0b22f3fda6cf9b589b2ea317))


### Bug Fixes

* **authentication:** admin patch user twoFaMethod ([#454](https://github.com/ConduitPlatform/Conduit/issues/454)) ([556c402](https://github.com/ConduitPlatform/Conduit/commit/556c402f6ccad3d2d580ceeda3f077b437d44cf2))
* get-conduit.sh linux arm64 detection ([#459](https://github.com/ConduitPlatform/Conduit/issues/459)) ([44635af](https://github.com/ConduitPlatform/Conduit/commit/44635af3e801cd74c7ee39e0f358ed0c8794e2b1))
* **grpc-sdk,admin:** config object patch array field merging ([#464](https://github.com/ConduitPlatform/Conduit/issues/464)) ([ef1e4fe](https://github.com/ConduitPlatform/Conduit/commit/ef1e4fe1553c2317038799baf85a3b514110a0e4))
* **grpc-sdk:** Metrics labeling ([#466](https://github.com/ConduitPlatform/Conduit/issues/466)) ([5843a2d](https://github.com/ConduitPlatform/Conduit/commit/5843a2dfd7abd62cc7b45948146c48bbaf60fafd))
* **grpc-sdk:** redis url remap ([#457](https://github.com/ConduitPlatform/Conduit/issues/457)) ([5fd0dad](https://github.com/ConduitPlatform/Conduit/commit/5fd0dade6d11c44ee6a40d7dbb1b77959cd79f41))
* **hermes:** swagger path/query params being shown as objects ([b285db2](https://github.com/ConduitPlatform/Conduit/commit/b285db26f90d13321a4a308d61f870b9c42c876b))

### [0.15.7](https://github.com/ConduitPlatform/Conduit/compare/v0.15.6...v0.15.7) (2022-11-25)


### Features

* **database,grpc-sdk:** raw query support ([#445](https://github.com/ConduitPlatform/Conduit/issues/445)) ([d715f47](https://github.com/ConduitPlatform/Conduit/commit/d715f471603e123768a43e454b9017cb414ce973))
* **grpc-sdk,hermes,admin,router:** request params split ([#446](https://github.com/ConduitPlatform/Conduit/issues/446)) ([70dcc7b](https://github.com/ConduitPlatform/Conduit/commit/70dcc7b8df035590849cfb28825db846db5f2359))
* **hermes,grpc-sdk:** route field and return descriptions support ([#439](https://github.com/ConduitPlatform/Conduit/issues/439)) ([59b745f](https://github.com/ConduitPlatform/Conduit/commit/59b745f85304526261b40f0267232ada09034253))
* Improved redis support (auth, sentinel, cluster) ([#435](https://github.com/ConduitPlatform/Conduit/issues/435)) ([e272105](https://github.com/ConduitPlatform/Conduit/commit/e2721051bde2326af948d577855c5e170e249945))


### Bug Fixes

* **core:** missing fs-extra ([1cdac90](https://github.com/ConduitPlatform/Conduit/commit/1cdac9015ed697d63e297aff61ce9af3098cd99f))
* **database:** no error when setting body params in GET/DELETE custom endpoints ([#442](https://github.com/ConduitPlatform/Conduit/issues/442)) ([676a4e5](https://github.com/ConduitPlatform/Conduit/commit/676a4e559444d3a76118123a20de8d451a13d565))
* **grpc-sdk:** missing fs-extra ([#444](https://github.com/ConduitPlatform/Conduit/issues/444)) ([61b1e83](https://github.com/ConduitPlatform/Conduit/commit/61b1e83abac63e643aa5743cb194666752e466c5))
* **router,admin,hermes:** new redis options compatibility ([#443](https://github.com/ConduitPlatform/Conduit/issues/443)) ([f0f2202](https://github.com/ConduitPlatform/Conduit/commit/f0f220286514c01fc997b133fbe7f84240054386))
* **router:** graphql explorer not working ([7c1cec7](https://github.com/ConduitPlatform/Conduit/commit/7c1cec7298023df336be337e9ea927198f1b5264))

### [0.15.6](https://github.com/ConduitPlatform/Conduit/compare/v0.15.5...v0.15.6) (2022-11-18)


### Bug Fixes

* **database:** check for schema ownership in case of unique index creation ([#434](https://github.com/ConduitPlatform/Conduit/issues/434)) ([cf66de9](https://github.com/ConduitPlatform/Conduit/commit/cf66de92097555e3135d188e6dc8ee222e856a26))
* **database:** custom endpoint handler createString length check ([#436](https://github.com/ConduitPlatform/Conduit/issues/436)) ([54b03cc](https://github.com/ConduitPlatform/Conduit/commit/54b03cc879868e9edd7aa4bbdf833873f9191993))

### [0.15.5](https://github.com/ConduitPlatform/Conduit/compare/v0.15.4...v0.15.5) (2022-11-17)


### Bug Fixes

* **database:** fix index creation bugs ([#431](https://github.com/ConduitPlatform/Conduit/issues/431)) ([5ce7483](https://github.com/ConduitPlatform/Conduit/commit/5ce74836b043d810245166704f8ef49a483fa5b0))
* **grpc-sdk:** router function wrappers crashes ([#433](https://github.com/ConduitPlatform/Conduit/issues/433)) ([e9e6383](https://github.com/ConduitPlatform/Conduit/commit/e9e638382b9490f48999b82ceeaeb008a83f30fd))

### [0.15.4](https://github.com/ConduitPlatform/Conduit/compare/v0.15.3...v0.15.4) (2022-11-17)


### Features

* **core,email,router:** sorting option missing in some routes. ([#424](https://github.com/ConduitPlatform/Conduit/issues/424)) ([f924eb4](https://github.com/ConduitPlatform/Conduit/commit/f924eb4a25afd7c1b254cad539789c616cbb9eec))
* **database,grpc-sdk:** index support ([#410](https://github.com/ConduitPlatform/Conduit/issues/410)) ([80f30b6](https://github.com/ConduitPlatform/Conduit/commit/80f30b6b4a5d09246200295ac829cbe783270c1d))
* **database:** add admin index routes ([#419](https://github.com/ConduitPlatform/Conduit/issues/419)) ([4180c9f](https://github.com/ConduitPlatform/Conduit/commit/4180c9f5cf0bb937641ebe47c3c22ca855a6822b))
* **grpc-sdk:** support for early request termination in router ([#420](https://github.com/ConduitPlatform/Conduit/issues/420)) ([9cce293](https://github.com/ConduitPlatform/Conduit/commit/9cce29366ba0bbd24ac19cedaee58a2b65b82082))


### Bug Fixes

* **database:** cms route sorting ([#425](https://github.com/ConduitPlatform/Conduit/issues/425)) ([a2f87c2](https://github.com/ConduitPlatform/Conduit/commit/a2f87c271784ea22a5ffb4d725d62c3c6e444680))
* **database:** custom endpoints not registering without crud endpoints ([#414](https://github.com/ConduitPlatform/Conduit/issues/414)) ([7fd206c](https://github.com/ConduitPlatform/Conduit/commit/7fd206c4cd58b0496faa0a32ff99254cf9668d23))
* **database:** custom endpoints query validation checking wrong access ([#418](https://github.com/ConduitPlatform/Conduit/issues/418)) ([f8307d6](https://github.com/ConduitPlatform/Conduit/commit/f8307d6af3d392bb6edd66402a23dd9f0c291665))
* **database:** fix sequelize sort ([#416](https://github.com/ConduitPlatform/Conduit/issues/416)) ([f226330](https://github.com/ConduitPlatform/Conduit/commit/f226330308bf521aa9ce3d289f95f1338dc07658))
* **database:** original schema clean ([#427](https://github.com/ConduitPlatform/Conduit/issues/427)) ([c9c6342](https://github.com/ConduitPlatform/Conduit/commit/c9c6342548c13da9dcda64a8655c2f3758083f40))
* **database:** remove throw on repetitive extension deletions ([#428](https://github.com/ConduitPlatform/Conduit/issues/428)) ([37fd87b](https://github.com/ConduitPlatform/Conduit/commit/37fd87b8026f7b4103f030930c702a7b45e5a522))
* **database:** schema extensions ([#423](https://github.com/ConduitPlatform/Conduit/issues/423)) ([97340a5](https://github.com/ConduitPlatform/Conduit/commit/97340a542b04911b222a525abb9f3072f0a74968))
* **grpc-sdk:** sequelize type import ([#430](https://github.com/ConduitPlatform/Conduit/issues/430)) ([13eb8be](https://github.com/ConduitPlatform/Conduit/commit/13eb8bece0aac26cefab3116d57bb5d892e9acba))
* **grpc-sdk:** sequelize type import ([#432](https://github.com/ConduitPlatform/Conduit/issues/432)) ([95cd423](https://github.com/ConduitPlatform/Conduit/commit/95cd4237d478a269f96adcd98588317639937831))
* **hermes, databse:** swagger & schema cleanups ([#417](https://github.com/ConduitPlatform/Conduit/issues/417)) ([da4531d](https://github.com/ConduitPlatform/Conduit/commit/da4531de186dae76637e01b073715ff65e8db4b4))

### [0.15.3](https://github.com/ConduitPlatform/Conduit/compare/v0.15.2...v0.15.3) (2022-11-04)


### Bug Fixes

* **database:** route declare order for crud ([#412](https://github.com/ConduitPlatform/Conduit/issues/412)) ([635cdb2](https://github.com/ConduitPlatform/Conduit/commit/635cdb2bf54138c037d68b0da778010ed943dd22))

### [0.15.2](https://github.com/ConduitPlatform/Conduit/compare/v0.15.1...v0.15.2) (2022-11-02)


### Features

* **push-notifications:** one signal provider ([#406](https://github.com/ConduitPlatform/Conduit/issues/406)) ([df63eb3](https://github.com/ConduitPlatform/Conduit/commit/df63eb38acb7a662d1720a8a51c49271410d84ed))


### Bug Fixes

* **authentication:** auth middleware excluded paths ([#405](https://github.com/ConduitPlatform/Conduit/issues/405)) ([4083491](https://github.com/ConduitPlatform/Conduit/commit/4083491cc1945dd3326aa20215800f038c140aa1))
* **database:** failing $exists and nullity queries in postgres ([#409](https://github.com/ConduitPlatform/Conduit/issues/409)) ([30bfde3](https://github.com/ConduitPlatform/Conduit/commit/30bfde3794d0385a1d49f4b41d4c35be0c4df88e))

### [0.15.1](https://github.com/ConduitPlatform/Conduit/compare/v0.15.0...v0.15.1) (2022-10-25)


### Features

* **authentication:** 2fa backup codes ([#404](https://github.com/ConduitPlatform/Conduit/issues/404)) ([e1d408f](https://github.com/ConduitPlatform/Conduit/commit/e1d408fcd637f751282b3ba7cd4a9416f7aadd30))
* **authentication:** apple provider  ([#374](https://github.com/ConduitPlatform/Conduit/issues/374)) ([47ec41f](https://github.com/ConduitPlatform/Conduit/commit/47ec41f8be58e6a3c31638bc8020bd748f52f7a1))
* **authentication:** bitbucket-provider ([#398](https://github.com/ConduitPlatform/Conduit/issues/398)) ([d093b88](https://github.com/ConduitPlatform/Conduit/commit/d093b889d3866e8536de820f8a128550888fd28f))
* **authentication:** linkedIn-provider ([#395](https://github.com/ConduitPlatform/Conduit/issues/395)) ([f815666](https://github.com/ConduitPlatform/Conduit/commit/f81566602b47da7c1ce7fb3f244210426a24d77c))
* **authentication:** reddit provider ([#400](https://github.com/ConduitPlatform/Conduit/issues/400)) ([fb009f7](https://github.com/ConduitPlatform/Conduit/commit/fb009f71cb2ca16c95314e23b5690e93142707f8))
* **authentication:** twitter provider ([#401](https://github.com/ConduitPlatform/Conduit/issues/401)) ([0eaa68b](https://github.com/ConduitPlatform/Conduit/commit/0eaa68b135c315ec2e2e8afdf58c142dbb19d31c))
* **core,admin,testing-tools:** core and admin tests  ([#317](https://github.com/ConduitPlatform/Conduit/issues/317)) ([b2a9d9d](https://github.com/ConduitPlatform/Conduit/commit/b2a9d9d39dafe682bed7c865468198c4f1d72e79))


### Bug Fixes

* **authentication:** linkedin post-merge issue ([1a1c353](https://github.com/ConduitPlatform/Conduit/commit/1a1c353931c19fcdda0fe4683b940d14ae499aa4))
* **core:** fix config bug ([#403](https://github.com/ConduitPlatform/Conduit/issues/403)) ([efd6dbc](https://github.com/ConduitPlatform/Conduit/commit/efd6dbc4b61564914fadeea93d5e40c3947d0543))
* **core:** move testing-tools to dev dependencies ([e6b09f6](https://github.com/ConduitPlatform/Conduit/commit/e6b09f639100df39235ea063d4530cae33dd9649))

## [0.15.0](https://github.com/ConduitPlatform/Conduit/compare/v0.15.0-rc.2...v0.15.0) (2022-10-21)


### Bug Fixes

* **grpc-sdk:** loki availability checks ([#402](https://github.com/ConduitPlatform/Conduit/issues/402)) ([3333b3a](https://github.com/ConduitPlatform/Conduit/commit/3333b3a69d6b6412559c36e91758ce5e97aa2b3e))

## [0.15.0-rc.2](https://github.com/ConduitPlatform/Conduit/compare/v0.15.0-rc.1...v0.15.0-rc.2) (2022-10-20)


### Features

* **grpc-sdk:** service address url remapping for host/docker interoperability ([#396](https://github.com/ConduitPlatform/Conduit/issues/396)) ([9cb859d](https://github.com/ConduitPlatform/Conduit/commit/9cb859ddd2a28f4e3d748134dcdcc05712f26d56))
* **storage:** getFolders() admin search query param ([#393](https://github.com/ConduitPlatform/Conduit/issues/393)) ([08cc08e](https://github.com/ConduitPlatform/Conduit/commit/08cc08ed16a8c4c527949c0e4dfdb232286a8627))


### Bug Fixes

* **authentication:** drop Kakao login leftovers ([#386](https://github.com/ConduitPlatform/Conduit/issues/386)) ([d36360c](https://github.com/ConduitPlatform/Conduit/commit/d36360ce31dce27e5333ba12b82cc051e9c0fd56))
* **authentication:** redirectUrl from router only set once ([#397](https://github.com/ConduitPlatform/Conduit/issues/397)) ([a81377b](https://github.com/ConduitPlatform/Conduit/commit/a81377b07b33039b4e88ae9fbba11f2e56249872))
* **authentication:** token provider singleton init router dependency ([#385](https://github.com/ConduitPlatform/Conduit/issues/385)) ([2ae9386](https://github.com/ConduitPlatform/Conduit/commit/2ae938608b4dc2692dd677932d0a206a7d86e27a))
* **core:** module config patch ([#388](https://github.com/ConduitPlatform/Conduit/issues/388)) ([6c9ffb2](https://github.com/ConduitPlatform/Conduit/commit/6c9ffb2458f0ad4aa50d8a88cb82e75a3e7f17c4))
* **core:** service discovery not emitting update events on module health updates ([#389](https://github.com/ConduitPlatform/Conduit/issues/389)) ([3444637](https://github.com/ConduitPlatform/Conduit/commit/3444637e9e91b53b5123e7a3b47f2c9192300e33))
* **database:** schema field validation ([#391](https://github.com/ConduitPlatform/Conduit/issues/391)) ([a12a921](https://github.com/ConduitPlatform/Conduit/commit/a12a9210a7d528824ce6d50425f1b41159380d4b))
* **email,forms:** replace forms event-based email health sync ([#390](https://github.com/ConduitPlatform/Conduit/issues/390)) ([6fea812](https://github.com/ConduitPlatform/Conduit/commit/6fea81256e59ce2226f5bba4d9fd1e0d77c54366))
* **grpc-sdk:** gRPC function wrapper async error catches ([#392](https://github.com/ConduitPlatform/Conduit/issues/392)) ([743125a](https://github.com/ConduitPlatform/Conduit/commit/743125a94007aa7d821c8b202e0868e00c009dd6))
* **push-notifications,sms:** health status ([#387](https://github.com/ConduitPlatform/Conduit/issues/387)) ([0e93eee](https://github.com/ConduitPlatform/Conduit/commit/0e93eee10a6f2c7762be83bed4cbbed4a521528a))
* **storage:** getFolders() admin route crash on undefined search query param ([#394](https://github.com/ConduitPlatform/Conduit/issues/394)) ([2af1dc0](https://github.com/ConduitPlatform/Conduit/commit/2af1dc05d7b48ae6fcff2e5018195817c6a41f22))

## [0.15.0-rc.1](https://github.com/ConduitPlatform/Conduit/compare/v0.15.0-rc.0...v0.15.0-rc.1) (2022-10-14)


### Features

* **authentication:** allow form_post responseMode on oAuth([#381](https://github.com/ConduitPlatform/Conduit/issues/381)) ([ff34ff6](https://github.com/ConduitPlatform/Conduit/commit/ff34ff6ad88ea44cd95d683f7a1095b17e4851dd))
* **core,grpc-sdk:** rework service discovery ([#383](https://github.com/ConduitPlatform/Conduit/issues/383)) ([321da3b](https://github.com/ConduitPlatform/Conduit/commit/321da3b519d3c3121ffe84c0a32ce8e2b4270b68))
* **grpc-sdk:** client connection logs ([#379](https://github.com/ConduitPlatform/Conduit/issues/379)) ([22c0c6d](https://github.com/ConduitPlatform/Conduit/commit/22c0c6dafa808992633edaf5d0af8b293de2a826))
* **grpc-sdk:** gRPC retries for unavailable services ([#377](https://github.com/ConduitPlatform/Conduit/issues/377)) ([05e6bf0](https://github.com/ConduitPlatform/Conduit/commit/05e6bf095d470ba50013643a2c898cff1fcea49f))


### Bug Fixes

* **admin:** generated config values reset on partial config update ([#375](https://github.com/ConduitPlatform/Conduit/issues/375)) ([b9da468](https://github.com/ConduitPlatform/Conduit/commit/b9da46811e87826e7e30085c9abfa3fca606bda0))
* **authentication:** migration not waiting for Config schema ([#376](https://github.com/ConduitPlatform/Conduit/issues/376)) ([41c2161](https://github.com/ConduitPlatform/Conduit/commit/41c2161b242ccaf1145645119a8198e7d64870a3))
* **grpc-sdk:** gRPC request retries for cancelled/aborted requests ([#380](https://github.com/ConduitPlatform/Conduit/issues/380)) ([b2d1049](https://github.com/ConduitPlatform/Conduit/commit/b2d10493630acea6e3d6884442609f77e7c4e1a8))

## [0.15.0-rc.0](https://github.com/ConduitPlatform/Conduit/compare/v0.14.6...v0.15.0-rc.0) (2022-10-07)


### ⚠ BREAKING CHANGES

* **database:** cms fixes, refactors, cleanups (#365)
* **grpc-sdk:** cleanups & improvements (#362)
* **authentication:** - User token renewal route now accepts refresh token through a bearer-formatted 'Authorization' header (eg: 'Bearer some-token-str') or 'refreshToken' cookie.
- Authentication schemas: 'userId' (string) -> 'user' (relation)

Co-authored-by: codefactor-io <support@codefactor.io>
Co-authored-by: Konstantinos Feretos <konferetos@tutanota.com>
Co-authored-by: Christina Papadogianni <59121443+ChrisPdgn@users.noreply.github.com>
Co-authored-by: Sotiria Stefa <72135844+SotiriaSte@users.noreply.github.com>
* metrics fixes, updates, cleanups (#338)
* update Readmes, remove legacy env compat (#329)
* **core,grpc-sdk:** remove deprecated gRPC functions (#328)
* Port renames (#326)
* **database,grpc-sdk:** compiled schema fields as gRPC schema type fields (#313)

### Features

* add node-2fa library ([#347](https://github.com/ConduitPlatform/Conduit/issues/347)) ([8dfea01](https://github.com/ConduitPlatform/Conduit/commit/8dfea012955c221da7a87c33f4b3cdff092eb53b))
* **admin,router:** host url initializer envs ([#373](https://github.com/ConduitPlatform/Conduit/issues/373)) ([d932b6d](https://github.com/ConduitPlatform/Conduit/commit/d932b6d8441e21b13647ac7ba14ab193a40ff45a))
* **admin:** admin user roles & 2FA with QR ([#327](https://github.com/ConduitPlatform/Conduit/issues/327)) ([8818c9e](https://github.com/ConduitPlatform/Conduit/commit/8818c9eee2e48ae64f7aeb2284012e107238b5d7))
* **admin:** get admin by id, unselect admin password field ([#341](https://github.com/ConduitPlatform/Conduit/issues/341)) ([9d02f02](https://github.com/ConduitPlatform/Conduit/commit/9d02f02afe49a63fab305ff10b1591af78913033))
* **authentication:** change verification time window for qr tokens ([#337](https://github.com/ConduitPlatform/Conduit/issues/337)) ([8d6d01e](https://github.com/ConduitPlatform/Conduit/commit/8d6d01edf5054fe576ddd3da6d8c4c97922b7dae))
* **authentication:** gitlab provider ([#369](https://github.com/ConduitPlatform/Conduit/issues/369)) ([777f3bc](https://github.com/ConduitPlatform/Conduit/commit/777f3bc9ac29f320fa75415ac7e8d003c2226903))
* **authentication:** passwordless login ([#346](https://github.com/ConduitPlatform/Conduit/issues/346)) ([7c9df4b](https://github.com/ConduitPlatform/Conduit/commit/7c9df4b3adc553578634f74d9def1da4dcea52a8))
* **authorization:** new authorization module based on Google's Zanzibar([#350](https://github.com/ConduitPlatform/Conduit/issues/350)) ([f275919](https://github.com/ConduitPlatform/Conduit/commit/f275919fe70cb82c90edf1a7413d482115717b74))
* **database,grpc-sdk:** compiled schema fields as gRPC schema type fields ([#313](https://github.com/ConduitPlatform/Conduit/issues/313)) ([da5b18a](https://github.com/ConduitPlatform/Conduit/commit/da5b18af4ccbd9e96ba3130a9e8ea98dbe09af72))
* **grpc-sdk,hermes:** rest/graphql cookies support ([#358](https://github.com/ConduitPlatform/Conduit/issues/358)) ([1645809](https://github.com/ConduitPlatform/Conduit/commit/1645809cb121b95fd573e4df785ac3ed4753fe4a))
* **grpc-sdk:** try/catch in wrapGrpcFunctions to wrap function calls ([#300](https://github.com/ConduitPlatform/Conduit/issues/300)) ([9e869a5](https://github.com/ConduitPlatform/Conduit/commit/9e869a5794f7e22ee6fb4747c30f36d68e345b52))
* **hermes,grpc-sdk,database:** db model router type registration ([#286](https://github.com/ConduitPlatform/Conduit/issues/286)) ([637470c](https://github.com/ConduitPlatform/Conduit/commit/637470c050274c828a5cfaa0e2d32ae6561b03ff))
* Prometheus Metrics Support ([#282](https://github.com/ConduitPlatform/Conduit/issues/282)) ([fa5f323](https://github.com/ConduitPlatform/Conduit/commit/fa5f3238616b50f4da69f0d4e297ac49d6524d72))
* route doc descriptions ([#322](https://github.com/ConduitPlatform/Conduit/issues/322)) ([981643b](https://github.com/ConduitPlatform/Conduit/commit/981643ba28afaf056dc4a53789d990d1852e054a))


### Bug Fixes

* **admin:** add package node2fa ([#333](https://github.com/ConduitPlatform/Conduit/issues/333)) ([29d3eab](https://github.com/ConduitPlatform/Conduit/commit/29d3eab0c33fa593849115ca2835f5e9fca1a1a1))
* **admin:** crashing on disabled metrics ([#339](https://github.com/ConduitPlatform/Conduit/issues/339)) ([a8b7ef5](https://github.com/ConduitPlatform/Conduit/commit/a8b7ef5f0029ea9a34ae3f86297c7ce590771075))
* **admin:** select in query to include password ([8fd20e0](https://github.com/ConduitPlatform/Conduit/commit/8fd20e05fc07274bdac89f732f0524a72efb9e5f))
* **admin:** super admin migration ([#334](https://github.com/ConduitPlatform/Conduit/issues/334)) ([21df3e2](https://github.com/ConduitPlatform/Conduit/commit/21df3e2e35bf447a4944314bff550b78d2f3b87d))
* **admin:** temporary token expiration time ([#344](https://github.com/ConduitPlatform/Conduit/issues/344)) ([ce520ca](https://github.com/ConduitPlatform/Conduit/commit/ce520ca8d6cbe3adc7453ca123bb2791fb33f28e))
* **admin:** token in verify2fa ([#340](https://github.com/ConduitPlatform/Conduit/issues/340)) ([0801ccf](https://github.com/ConduitPlatform/Conduit/commit/0801ccfb620b28b39e8669e41e3b6e3373e923cc))
* **admin:** verifyTwoFactorToken missing window param ([#343](https://github.com/ConduitPlatform/Conduit/issues/343)) ([a465f9d](https://github.com/ConduitPlatform/Conduit/commit/a465f9d9c4c5d537cf0133a71b0acaf93665c8e3))
* **authentication:**  twoFaMethod missing param in admin routes ([#321](https://github.com/ConduitPlatform/Conduit/issues/321)) ([4b504b9](https://github.com/ConduitPlatform/Conduit/commit/4b504b9a3f2f7824caffdc91a08dc55d5e5f0ac8))
* **authentication,database:** admin route definition handler binds ([#363](https://github.com/ConduitPlatform/Conduit/issues/363)) ([b0db3b9](https://github.com/ConduitPlatform/Conduit/commit/b0db3b9f618f833f2251ae79510965c28c9ff620))
* **authentication:** accidental startup errors ([#370](https://github.com/ConduitPlatform/Conduit/issues/370)) ([8fb8c53](https://github.com/ConduitPlatform/Conduit/commit/8fb8c538def2135016e6aca4c464bb6e73683f61))
* **authentication:** add clientId in magic link token data ([7a9f776](https://github.com/ConduitPlatform/Conduit/commit/7a9f77612167d355dfc9e6f21381990da1b5fa6b))
* **authentication:** add token to qr 2fa verification ([#336](https://github.com/ConduitPlatform/Conduit/issues/336)) ([3902d63](https://github.com/ConduitPlatform/Conduit/commit/3902d633b04a4714d75bfaf4b941f81e8a5b1393))
* **authentication:** config loading ([08525d5](https://github.com/ConduitPlatform/Conduit/commit/08525d55db67e1af3aa946de980443dbe2a34af6))
* **authentication:** config migration ([150dd05](https://github.com/ConduitPlatform/Conduit/commit/150dd059636828ea3335b9c19de766f71c035c78))
* **authentication:** forgot rateLimit removal ([b8d81f3](https://github.com/ConduitPlatform/Conduit/commit/b8d81f3817e8b578f9465f28da2fb0587f0e2bfe))
* **authentication:** get to post req on verify-qr-code endpoint ([#325](https://github.com/ConduitPlatform/Conduit/issues/325)) ([3c14e81](https://github.com/ConduitPlatform/Conduit/commit/3c14e81ebbf2559d076463cb6d295b9c574aa4d1))
* **authentication:** node-2fa dependency ([c869a3e](https://github.com/ConduitPlatform/Conduit/commit/c869a3e165dce0b1b855d0556992f3911d69818e))
* **authentication:** simplify monitors ([#351](https://github.com/ConduitPlatform/Conduit/issues/351)) ([24c86f5](https://github.com/ConduitPlatform/Conduit/commit/24c86f59b3265495ef81c4b6ced8b7826621d7e6))
* **authentication:** using wrong config ([c737138](https://github.com/ConduitPlatform/Conduit/commit/c737138ab2b6cba84ca372a9b3f217fd55754f88))
* broken discord link ([cee49c0](https://github.com/ConduitPlatform/Conduit/commit/cee49c01df9ed4eb6b002ab1bc1727033e89676e))
* **core:** module exist grpc function return type fixed ([#324](https://github.com/ConduitPlatform/Conduit/issues/324)) ([9fcc5d4](https://github.com/ConduitPlatform/Conduit/commit/9fcc5d4459622104e95c1db933822c7c29527a99))
* **database:** admin create schema return type regression ([#289](https://github.com/ConduitPlatform/Conduit/issues/289)) ([4f7979c](https://github.com/ConduitPlatform/Conduit/commit/4f7979c794fa0b63fdc1ad81b45796897bca2004))
* **database:** cms fixes, refactors, cleanups ([#365](https://github.com/ConduitPlatform/Conduit/issues/365)) ([84e377c](https://github.com/ConduitPlatform/Conduit/commit/84e377cd5ac198c09349d2341b81ea1c7f555392))
* **database:** createSchemaFromAdapter() crashing for non-registered schemas ([#315](https://github.com/ConduitPlatform/Conduit/issues/315)) ([8c17583](https://github.com/ConduitPlatform/Conduit/commit/8c175837a4dc0494eab470b94a292536d2b09114))
* **database:** DeclaredSchema compiledFields extension field and custom endpoint generation ([#290](https://github.com/ConduitPlatform/Conduit/issues/290)) ([6b7eb84](https://github.com/ConduitPlatform/Conduit/commit/6b7eb84ea298bf59fea41d9afd5f77f019f52049))
* **database:** getSchemas filters, declared schema collectionName uniqueness constraint ([#368](https://github.com/ConduitPlatform/Conduit/issues/368)) ([245fe13](https://github.com/ConduitPlatform/Conduit/commit/245fe13d0fa81b6958620aa61ad74f4af559c08a))
* **database:** gRPC schema registration removing schema extensions from adapter models ([#293](https://github.com/ConduitPlatform/Conduit/issues/293)) ([47bf1c9](https://github.com/ConduitPlatform/Conduit/commit/47bf1c9b9ea0cbeeb2accbb909a73b6e67d4a9b7))
* **database:** initial db schema registration ([#345](https://github.com/ConduitPlatform/Conduit/issues/345)) ([235955e](https://github.com/ConduitPlatform/Conduit/commit/235955e2c93ba30072e0d2baab0979e77bf96eb7))
* **database:** modelOptions cms validation, unrebased modelSchema reference ([#305](https://github.com/ConduitPlatform/Conduit/issues/305)) ([4c18988](https://github.com/ConduitPlatform/Conduit/commit/4c189882877e97d4fe15e3d63d7e61755ec02090))
* **database:** schema types, stitching, custom endpoints ([#311](https://github.com/ConduitPlatform/Conduit/issues/311)) ([8d5471b](https://github.com/ConduitPlatform/Conduit/commit/8d5471b8672e42350f7f69ca078775c98b29b8c5))
* **database:** startup model recovery, deleteSchema admin route ([#332](https://github.com/ConduitPlatform/Conduit/issues/332)) ([43eb8fd](https://github.com/ConduitPlatform/Conduit/commit/43eb8fd320592129a7437c90a60539f2c154174b))
* **email:** subject field could be missing ([#366](https://github.com/ConduitPlatform/Conduit/issues/366)) ([72907eb](https://github.com/ConduitPlatform/Conduit/commit/72907ebb8e81f5aaed68b786740bd1752552679e))
* **forms:** getForms count not using search query ([#314](https://github.com/ConduitPlatform/Conduit/issues/314)) ([a687fda](https://github.com/ConduitPlatform/Conduit/commit/a687fda6c116d5f14f4750e9b4054d9418154405))
* **grpc-sdk,database:** crash on unconditional Sequelize metrics ([#295](https://github.com/ConduitPlatform/Conduit/issues/295)) ([86666e0](https://github.com/ConduitPlatform/Conduit/commit/86666e00875475a119716b7a749db92cef50e4c9))
* **grpc-sdk:** admin_grpc_requests_total metric ([#372](https://github.com/ConduitPlatform/Conduit/issues/372)) ([5af2ada](https://github.com/ConduitPlatform/Conduit/commit/5af2adac83921a0faf2b32cd1260e2cbe717aac6))
* **hermes:** GraphQL mutation result nesting ([#342](https://github.com/ConduitPlatform/Conduit/issues/342)) ([7c49340](https://github.com/ConduitPlatform/Conduit/commit/7c493403288b61284326541b954bb3ecd9081a9d))
* **hermes:** named route response types handled as string responses ([#331](https://github.com/ConduitPlatform/Conduit/issues/331)) ([6d86c10](https://github.com/ConduitPlatform/Conduit/commit/6d86c10d88d35009734965198c04207ba7e6071f))
* **hermes:** not throwing an error on unavaibable route middlewares ([#308](https://github.com/ConduitPlatform/Conduit/issues/308)) ([da05bf7](https://github.com/ConduitPlatform/Conduit/commit/da05bf726cb48c31ed1e067b32b2f26707db5f54))
* metrics fixes, updates, cleanups ([#338](https://github.com/ConduitPlatform/Conduit/issues/338)) ([9369cee](https://github.com/ConduitPlatform/Conduit/commit/9369ceedd3e91caa8245815feee50d58e61d6734))
* **push-notifications:** crash loops ([113fcfb](https://github.com/ConduitPlatform/Conduit/commit/113fcfbc6d07403fce12ec1021d42a06290d8ef0))
* **sms:** not starting up with invalid config ([#294](https://github.com/ConduitPlatform/Conduit/issues/294)) ([eb57231](https://github.com/ConduitPlatform/Conduit/commit/eb57231877649630ff85e038ca8135e0756e094b))
* **storage:** initialize metrics assuming files exist ([#349](https://github.com/ConduitPlatform/Conduit/issues/349)) ([f046c7b](https://github.com/ConduitPlatform/Conduit/commit/f046c7bfb1b1840232414a9dee3cf01cb052c05e))


* **authentication:** major code cleanup ([#354](https://github.com/ConduitPlatform/Conduit/issues/354)) ([1136a0f](https://github.com/ConduitPlatform/Conduit/commit/1136a0f49564cf6de3ba56c4c0d4d660464c2607))
* **core,grpc-sdk:** remove deprecated gRPC functions ([#328](https://github.com/ConduitPlatform/Conduit/issues/328)) ([0fef34a](https://github.com/ConduitPlatform/Conduit/commit/0fef34a453435f56c4862390ff948ab3a7d47e1c))
* **grpc-sdk:** cleanups & improvements ([#362](https://github.com/ConduitPlatform/Conduit/issues/362)) ([43b2787](https://github.com/ConduitPlatform/Conduit/commit/43b27877c9f4ede0f9988357a430e0e8ca35e49d))
* Port renames ([#326](https://github.com/ConduitPlatform/Conduit/issues/326)) ([620d673](https://github.com/ConduitPlatform/Conduit/commit/620d673d6fa9c15c69a1989da07f4c5d40af6dd4))
* update Readmes, remove legacy env compat ([#329](https://github.com/ConduitPlatform/Conduit/issues/329)) ([de0556d](https://github.com/ConduitPlatform/Conduit/commit/de0556d030d9d047e9fa687aab22a4730c8ca787))

### [0.14.7](https://github.com/ConduitPlatform/Conduit/compare/v0.14.6...v0.14.7) (2022-08-31)


### Features

* Prometheus Metrics Support ([#282](https://github.com/ConduitPlatform/Conduit/issues/282)) ([fa5f323](https://github.com/ConduitPlatform/Conduit/commit/fa5f3238616b50f4da69f0d4e297ac49d6524d72))


### Bug Fixes

* **database:** admin create schema return type regression ([#289](https://github.com/ConduitPlatform/Conduit/issues/289)) ([4f7979c](https://github.com/ConduitPlatform/Conduit/commit/4f7979c794fa0b63fdc1ad81b45796897bca2004))
* **database:** DeclaredSchema compiledFields extension field and custom endpoint generation ([#290](https://github.com/ConduitPlatform/Conduit/issues/290)) ([6b7eb84](https://github.com/ConduitPlatform/Conduit/commit/6b7eb84ea298bf59fea41d9afd5f77f019f52049))
* **database:** gRPC schema registration removing schema extensions from adapter models ([#293](https://github.com/ConduitPlatform/Conduit/issues/293)) ([47bf1c9](https://github.com/ConduitPlatform/Conduit/commit/47bf1c9b9ea0cbeeb2accbb909a73b6e67d4a9b7))
* **grpc-sdk,database:** crash on unconditional Sequelize metrics ([#295](https://github.com/ConduitPlatform/Conduit/issues/295)) ([86666e0](https://github.com/ConduitPlatform/Conduit/commit/86666e00875475a119716b7a749db92cef50e4c9))
* **grpc-sdk:** npm build crashing ([bce9618](https://github.com/ConduitPlatform/Conduit/commit/bce9618af06c6149f38612f1369c6b74551b042b))
* **sms:** not starting up with invalid config ([#294](https://github.com/ConduitPlatform/Conduit/issues/294)) ([eb57231](https://github.com/ConduitPlatform/Conduit/commit/eb57231877649630ff85e038ca8135e0756e094b))

### [0.14.6](https://github.com/ConduitPlatform/Conduit/compare/v0.14.5...v0.14.6) (2022-08-24)


### Features

* **authentication:** add qr code library for 2fa authentication ([#283](https://github.com/ConduitPlatform/Conduit/issues/283)) ([37a6fa9](https://github.com/ConduitPlatform/Conduit/commit/37a6fa9901266e8672f2a44b5ef6b5a65b979236))


### Bug Fixes

* **admin,hermes:** GraphQL middleware and return type fixes ([#279](https://github.com/ConduitPlatform/Conduit/issues/279)) ([d219d52](https://github.com/ConduitPlatform/Conduit/commit/d219d523a0265df59ec379c2292de9b41941b81b))
* **admin:** auth middleware body query check ([#281](https://github.com/ConduitPlatform/Conduit/issues/281)) ([26d0a09](https://github.com/ConduitPlatform/Conduit/commit/26d0a09509abedf2c47d1f5c9d415392c2179688))
* **core:** admin config update channel inconsistency ([#285](https://github.com/ConduitPlatform/Conduit/issues/285)) ([598a8e5](https://github.com/ConduitPlatform/Conduit/commit/598a8e5f66303005f5588be3dbb527358537e908))
* **database,email,forms:** handler returned type not matching declared type ([#280](https://github.com/ConduitPlatform/Conduit/issues/280)) ([a537453](https://github.com/ConduitPlatform/Conduit/commit/a5374539c60b59df6cf38028a4ed00ec6b1bb050))
* **database:** db schema validation not working for JSONB type ([#287](https://github.com/ConduitPlatform/Conduit/issues/287)) ([973cac2](https://github.com/ConduitPlatform/Conduit/commit/973cac2fb030dd50b408a6856017a76cf2d8f0cf))
* invalid config updates polluting Convict config object ([#288](https://github.com/ConduitPlatform/Conduit/issues/288)) ([28a71eb](https://github.com/ConduitPlatform/Conduit/commit/28a71ebdcb831d5126dbae31cb858f7b997ac214))

### [0.14.5](https://github.com/ConduitPlatform/Conduit/compare/v0.14.4...v0.14.5) (2022-08-05)


### Features

* **admin,core,router:** ping routes ([#275](https://github.com/ConduitPlatform/Conduit/issues/275)) ([df52f78](https://github.com/ConduitPlatform/Conduit/commit/df52f7855edc285a11b78572c6fe0f2c6aff27fb))


### Bug Fixes

* **core,admin,router:** router types ([#278](https://github.com/ConduitPlatform/Conduit/issues/278)) ([d960d53](https://github.com/ConduitPlatform/Conduit/commit/d960d53c1cecb176533ad82b3d41fc65ac86f91a))
* **core:** fix configureModule not passing schema to register routes ([#277](https://github.com/ConduitPlatform/Conduit/issues/277)) ([bd780a3](https://github.com/ConduitPlatform/Conduit/commit/bd780a3ce0c9e5b08f704f7d9641c7400ed1d6f5))
* **hermes,router:**  socket registration, security client validation ([#274](https://github.com/ConduitPlatform/Conduit/issues/274)) ([fe03197](https://github.com/ConduitPlatform/Conduit/commit/fe031976991d7fa055a8d8d86a2c35efa8a0a887))
* **hermes:** swagger admin section includes admin config routes ([#276](https://github.com/ConduitPlatform/Conduit/issues/276)) ([5e4bdd9](https://github.com/ConduitPlatform/Conduit/commit/5e4bdd9c4769f289a53f4b97e88b365fb95755cb))

### [0.14.4](https://github.com/ConduitPlatform/Conduit/compare/v0.14.3...v0.14.4) (2022-07-27)


### Features

* **core:** recover module config routes ([#271](https://github.com/ConduitPlatform/Conduit/issues/271)) ([b22b932](https://github.com/ConduitPlatform/Conduit/commit/b22b932cd2e9e9e1c7675117b94df6e957e4fc86))


### Bug Fixes

* **core:** config set not working ([#270](https://github.com/ConduitPlatform/Conduit/issues/270)) ([d73fd09](https://github.com/ConduitPlatform/Conduit/commit/d73fd09a627e7dd952f9b8c6ba3af9005994b3a1))
* **core:** config set not working (again) ([3575f1f](https://github.com/ConduitPlatform/Conduit/commit/3575f1f5fddfcdf84b55b00237642d3aefcd4158))

### [0.14.3](https://github.com/ConduitPlatform/Conduit/compare/v0.14.2...v0.14.3) (2022-07-27)


### Features

* add strict option to convict validation & specific config endpoints ([#266](https://github.com/ConduitPlatform/Conduit/issues/266)) ([e35edbd](https://github.com/ConduitPlatform/Conduit/commit/e35edbd31a67e2ec8c57830675744532e4876d5b))
* **authentication:** implement change email ([#255](https://github.com/ConduitPlatform/Conduit/issues/255)) ([9ef6663](https://github.com/ConduitPlatform/Conduit/commit/9ef66631720033e45b0c385b281411f5cf983f8b))
* **authentication:** resend verification email  ([#264](https://github.com/ConduitPlatform/Conduit/issues/264)) ([2235d26](https://github.com/ConduitPlatform/Conduit/commit/2235d26c4d70f0c7e16bf342615da3134d8e396c))
* **grpc-sdk:** add module instance id to loki logger ([#263](https://github.com/ConduitPlatform/Conduit/issues/263)) ([cf38f85](https://github.com/ConduitPlatform/Conduit/commit/cf38f8555cc78485bc6232fdf603051d58f9283a))


### Bug Fixes

* **admin,commons,core,grpc-sdk,router,storage:** config updates ([#267](https://github.com/ConduitPlatform/Conduit/issues/267)) ([4fbad08](https://github.com/ConduitPlatform/Conduit/commit/4fbad08a5e76ad6e09db6ae323592cbd8f60d251))
* **admin,core,grpc-sdk:** initial config sync ([#269](https://github.com/ConduitPlatform/Conduit/issues/269)) ([ff23852](https://github.com/ConduitPlatform/Conduit/commit/ff238528ab86f537fb3bfb29dcfe7907c553669e))
* **admin,core:** config not falling-back properly ([ecc8e8c](https://github.com/ConduitPlatform/Conduit/commit/ecc8e8cc8d27e28cd8c9fd8667a9c221dbc5bf6c))
* **admin,router:** helmet blocking slash-suffixed graphql endpoints ([#265](https://github.com/ConduitPlatform/Conduit/issues/265)) ([d532dcb](https://github.com/ConduitPlatform/Conduit/commit/d532dcb66947be94a32680deb6d59633cd6d5218))
* **admin:** outdated master key warning check ([#262](https://github.com/ConduitPlatform/Conduit/issues/262)) ([15af18e](https://github.com/ConduitPlatform/Conduit/commit/15af18eff83f6b6b0c167e66e78d00d51cb6c61d))
* **authentication:** email dependent app route registration ([#257](https://github.com/ConduitPlatform/Conduit/issues/257)) ([ae78612](https://github.com/ConduitPlatform/Conduit/commit/ae786122903e9d23d536fb2bea847fdd06bc353f))
* **core:** fix get config routes not working ([#268](https://github.com/ConduitPlatform/Conduit/issues/268)) ([33abce6](https://github.com/ConduitPlatform/Conduit/commit/33abce606a4edf023178014ff3c23c86b30895f2))
* **grpc-sdk:** module inconsistency on momentary core unavailability ([#258](https://github.com/ConduitPlatform/Conduit/issues/258)) ([d8c753c](https://github.com/ConduitPlatform/Conduit/commit/d8c753c3c63cc2609bea0ad5d123d2f388dc7664))
* **grpc-sdk:** monitorModule() not awaiting module before first callback call ([#256](https://github.com/ConduitPlatform/Conduit/issues/256)) ([f638d5f](https://github.com/ConduitPlatform/Conduit/commit/f638d5f89994f49241132c890ad48c44f7f3f982))
* **hermes:** Swagger route tags ([#259](https://github.com/ConduitPlatform/Conduit/issues/259)) ([04549b0](https://github.com/ConduitPlatform/Conduit/commit/04549b0a4e00d2ad7d08e875792db2de48668092))

### [0.14.2](https://github.com/ConduitPlatform/Conduit/compare/v0.14.1...v0.14.2) (2022-07-21)


### Features

* **database:** convert json type of postgres dbs to jsonb ([#253](https://github.com/ConduitPlatform/Conduit/issues/253)) ([4e13464](https://github.com/ConduitPlatform/Conduit/commit/4e134649c861e634eebece15e968935a07a31cb5))

### [0.14.1](https://github.com/ConduitPlatform/Conduit/compare/v0.14.0...v0.14.1) (2022-07-20)


### Features

* **grpc-sdk:** add support for logging to Grafana Loki ([#249](https://github.com/ConduitPlatform/Conduit/issues/249)) ([422b03e](https://github.com/ConduitPlatform/Conduit/commit/422b03eccc97baf04a7f1ba730b718d534fcfe74))


### Bug Fixes

* **authentication:** user model dropping hashedPassword due to object ref deletion ([#252](https://github.com/ConduitPlatform/Conduit/issues/252)) ([7502831](https://github.com/ConduitPlatform/Conduit/commit/75028310752d69155486550d42ceae7078b65866))
* **core:** service discovery registering new modules as serving ([#250](https://github.com/ConduitPlatform/Conduit/issues/250)) ([4d3f7a4](https://github.com/ConduitPlatform/Conduit/commit/4d3f7a44b9d149dd2c7c9c98e46680c88cc5c42d))

## [0.14.0](https://github.com/ConduitPlatform/Conduit/compare/v0.14.0-rc.1...v0.14.0) (2022-07-15)


### Bug Fixes

* **database:** createWithPopulations looking for wrong properties ([#245](https://github.com/ConduitPlatform/Conduit/issues/245)) ([b8c8c8c](https://github.com/ConduitPlatform/Conduit/commit/b8c8c8c7b24148db745399bd9aacc95da952963f))
* **database:** fix cms schemas aggregation from declared ([#244](https://github.com/ConduitPlatform/Conduit/issues/244)) ([c852a5a](https://github.com/ConduitPlatform/Conduit/commit/c852a5a3fa252963245928521b8f7db4149b62ec))
* **database:** get pending schema model based on collection name ([#246](https://github.com/ConduitPlatform/Conduit/issues/246)) ([46b8800](https://github.com/ConduitPlatform/Conduit/commit/46b880086ef65fea67d6e24212a989718a2344c7))

## [0.14.0-rc.1](https://github.com/ConduitPlatform/Conduit/compare/v0.14.0-0...v0.14.0-rc.1) (2022-07-14)


### ⚠ BREAKING CHANGES

* **core:** convert update config to a patch route (#243)
* **admin:** remove admin prefix from routes (#242)

### Features

* **database:** db engine connection attempts during startup ([#223](https://github.com/ConduitPlatform/Conduit/issues/223)) ([7c45ce7](https://github.com/ConduitPlatform/Conduit/commit/7c45ce7627561504906b4d7bfab64e812979cb74))


### Bug Fixes

* **forms:** not properly waiting for router ([207d6e2](https://github.com/ConduitPlatform/Conduit/commit/207d6e2d06c826abd38a1463dcc9be716d4f90c8))


* **admin:** remove admin prefix from routes ([#242](https://github.com/ConduitPlatform/Conduit/issues/242)) ([55f1766](https://github.com/ConduitPlatform/Conduit/commit/55f176646151613117d1883fb35ab81a5336dadd))
* **core:** convert update config to a patch route ([#243](https://github.com/ConduitPlatform/Conduit/issues/243)) ([f68e1c8](https://github.com/ConduitPlatform/Conduit/commit/f68e1c827bdc8e995508d3e266b7050d47fd7533))

## [0.14.0-rc.0](https://github.com/ConduitPlatform/Conduit/compare/v0.14.0-0...v0.14.0-rc.0) (2022-07-07)

## [0.14.0-0](https://github.com/ConduitPlatform/Conduit/compare/v0.13.1...v0.14.0-0) (2022-07-06)


### ⚠ BREAKING CHANGES

* **router,config,core,admin,commons:** architecture change (#212)

### Features

* **admin:** helmet middleware ([#217](https://github.com/ConduitPlatform/Conduit/issues/217)) ([2d241fa](https://github.com/ConduitPlatform/Conduit/commit/2d241faf7105f21e1f83b6cd884e8deab098013f))


### Bug Fixes

* **core:** config crash when module configuration missing from redis on firstSync ([8b3484c](https://github.com/ConduitPlatform/Conduit/commit/8b3484cc0488d3d2c8e065d606b51a4b7f6ffcc5))
* **core:** config firstSync not waiting for promises ([16bc12d](https://github.com/ConduitPlatform/Conduit/commit/16bc12d4a2cb2a16d6f00f4fec8b7b0040ac11ce))
* **grpc-sdk,commons,core,admin:** config validation ([#219](https://github.com/ConduitPlatform/Conduit/issues/219)) ([7526220](https://github.com/ConduitPlatform/Conduit/commit/7526220a326c3f5fe5fb3c4d6941e6e86aa6d96a))
* **grpc-sdk:** module configurations being reset on startup ([#225](https://github.com/ConduitPlatform/Conduit/issues/225)) ([6ea3fe6](https://github.com/ConduitPlatform/Conduit/commit/6ea3fe6e28e2410273277d5914ae67ea7cd9e7f7))
* **grpc-sdk:** module connectivity reporting ([#222](https://github.com/ConduitPlatform/Conduit/issues/222)) ([59bdac5](https://github.com/ConduitPlatform/Conduit/commit/59bdac5223dc3df60b4093b6bedff8ef7bcac519))
* **router:** not registering SetConfig rpc ([#218](https://github.com/ConduitPlatform/Conduit/issues/218)) ([245554a](https://github.com/ConduitPlatform/Conduit/commit/245554a9c8bd41607d9bbabc54495f0d20c9d309))
* **storage:** registering routes while disabled ([#224](https://github.com/ConduitPlatform/Conduit/issues/224)) ([58897b1](https://github.com/ConduitPlatform/Conduit/commit/58897b188eb9e2fa2202a9b6619ecb45a22c19cd))


* **router,config,core,admin,commons:** architecture change ([#212](https://github.com/ConduitPlatform/Conduit/issues/212)) ([bdde3cd](https://github.com/ConduitPlatform/Conduit/commit/bdde3cdfd644b028b6f7b3d2e1bcb5e25d1286c6))

### [0.13.1](https://github.com/ConduitPlatform/Conduit/compare/v0.13.0...v0.13.1) (2022-06-23)


### Features

* **grpc-sdk:** add conduit logger for consistent logging ([#213](https://github.com/ConduitPlatform/Conduit/issues/213)) ([6af6bb8](https://github.com/ConduitPlatform/Conduit/commit/6af6bb8e462ccb2ae2b1a171ef9b550722d4d068))


### Bug Fixes

* **database:** wrong introspection counts ([#216](https://github.com/ConduitPlatform/Conduit/issues/216)) ([30316d4](https://github.com/ConduitPlatform/Conduit/commit/30316d4fa7a6bfa4052f5a8ab04faf194c511857))

## [0.13.0](https://github.com/ConduitPlatform/Conduit/compare/v0.13.0-rc.3...v0.13.0) (2022-06-17)


### Features

* **authentication,chat,database,email,forms,storage,security:** admin route sorting ([#211](https://github.com/ConduitPlatform/Conduit/issues/211)) ([b3427fb](https://github.com/ConduitPlatform/Conduit/commit/b3427fbc32c7c8765e211ebd0c35e58125dc8226))

## [0.13.0-rc.3](https://github.com/ConduitPlatform/Conduit/compare/v0.13.0-rc.2...v0.13.0-rc.3) (2022-06-16)


### Features

* **grpc-sdk,commons,security:** cli security client platform, ping route security middleware exceptions ([#207](https://github.com/ConduitPlatform/Conduit/issues/207)) ([11b7ceb](https://github.com/ConduitPlatform/Conduit/commit/11b7ceb1cb365f61449d1772c59a753eeb179c8e))


### Bug Fixes

* **router,grpc-sdk:** swagger generation ([#206](https://github.com/ConduitPlatform/Conduit/issues/206)) ([6cd7ce0](https://github.com/ConduitPlatform/Conduit/commit/6cd7ce05f02c7917728743380ad8d040488189ed))
* **security:** security client aliases are not unique ([#208](https://github.com/ConduitPlatform/Conduit/issues/208)) ([90b4545](https://github.com/ConduitPlatform/Conduit/commit/90b4545f3c057f6115d8919535e41c961492203e))

## [0.13.0-rc.2](https://github.com/ConduitPlatform/Conduit/compare/v0.13.0-rc.1...v0.13.0-rc.2) (2022-06-14)


### Bug Fixes

* rxjs operators required on runtime ([#205](https://github.com/ConduitPlatform/Conduit/issues/205)) ([85ec429](https://github.com/ConduitPlatform/Conduit/commit/85ec42940d4e7f5610b9da5c5d7c0c039b1da46c))

## [0.13.0-rc.1](https://github.com/ConduitPlatform/Conduit/compare/v0.13.0-rc0...v0.13.0-rc.1) (2022-06-13)


### Features

* **security:** added notes and alias options for creating client ids ([#196](https://github.com/ConduitPlatform/Conduit/issues/196)) ([f79eba0](https://github.com/ConduitPlatform/Conduit/commit/f79eba034e32e42bb796118125c7ea88c2802070))
* **storage:** aliyun storage provider ([#199](https://github.com/ConduitPlatform/Conduit/issues/199)) ([0c04b94](https://github.com/ConduitPlatform/Conduit/commit/0c04b9459ca4b885e81e3f54e980351ee89f0ce8))


### Bug Fixes

* **authentication:** wrong param types in OAuth2 requests ([#198](https://github.com/ConduitPlatform/Conduit/issues/198)) ([90c07f3](https://github.com/ConduitPlatform/Conduit/commit/90c07f35129f3fab0c52036a646f86c3d7000d85))
* grpc-sdk publishing action ([81311a7](https://github.com/ConduitPlatform/Conduit/commit/81311a71a8454c148dc36844ebb21c1fc0f65317))

## [0.13.0-rc.0](https://github.com/ConduitPlatform/Conduit/compare/v0.12.6...v0.13.0-rc.0) (2022-06-07)


### ⚠ BREAKING CHANGES

* **admin:** admin users crud ops (#177)
* **database:** crud granularity (#180)
* This does not affect the APIs.
Modules simply require a rebuild using the latest grpc-sdk.

### Features

* **admin:** admin users crud ops ([#177](https://github.com/ConduitPlatform/Conduit/issues/177)) ([7f84036](https://github.com/ConduitPlatform/Conduit/commit/7f84036d5477cac19af20c4822de0c7edde932c9))
* **authentication, router, grpc-sdk:** support for cookies ([bc6967e](https://github.com/ConduitPlatform/Conduit/commit/bc6967ea89c40d53fdd109b60f96ef485a99caee))
* **authentication:** logins and logouts from multiple clients/sessions ([#138](https://github.com/ConduitPlatform/Conduit/issues/138)) ([816da50](https://github.com/ConduitPlatform/Conduit/commit/816da50f6ad820c2f9cf486fdb60111f7fa86d61))
* **chat:** chat room invites ([#119](https://github.com/ConduitPlatform/Conduit/issues/119)) ([34c87a8](https://github.com/ConduitPlatform/Conduit/commit/34c87a8553c4743abd1caba82ca39a7f684e3648))
* **chat:** send push notifications for invite([#124](https://github.com/ConduitPlatform/Conduit/issues/124)) ([32dd502](https://github.com/ConduitPlatform/Conduit/commit/32dd502b3d8280c1f8f6d3fe46494b6395d633e9))
* **config:** DEBUG__DISABLE_INACTIVE_MODULE_REMOVAL env var ([#178](https://github.com/ConduitPlatform/Conduit/issues/178)) ([8ac2d96](https://github.com/ConduitPlatform/Conduit/commit/8ac2d9655ef589cd28d29072e5e06d22a67a4b8c))
* **database:** crud granularity ([#180](https://github.com/ConduitPlatform/Conduit/issues/180)) ([86cfa37](https://github.com/ConduitPlatform/Conduit/commit/86cfa3714707e53d3b2ef28c1d7cb0d25b748b04))
* **database:** DB introspection ([#128](https://github.com/ConduitPlatform/Conduit/issues/128)) ([49680fe](https://github.com/ConduitPlatform/Conduit/commit/49680feda2848f45a4e3e133cb35ad8408b27a56))
* **database:** disable auto-introspection ([#186](https://github.com/ConduitPlatform/Conduit/issues/186)) ([da9a3df](https://github.com/ConduitPlatform/Conduit/commit/da9a3df614411fedc0886d1df7b16e8f982b4ea0))
* gRPC request protection ([#133](https://github.com/ConduitPlatform/Conduit/issues/133)) ([409fde5](https://github.com/ConduitPlatform/Conduit/commit/409fde57d74befeba127a87a7d93024b1a806dc6))
* reactive module dependency handling ([#150](https://github.com/ConduitPlatform/Conduit/issues/150)) ([275c50c](https://github.com/ConduitPlatform/Conduit/commit/275c50c3436ae543ed4ff5a8598b97285b7de0dc))
* **security:** configurable client validation ([60963d7](https://github.com/ConduitPlatform/Conduit/commit/60963d76c1ca2e19f572b5ab6f35d020e6d81ef1))


### Bug Fixes

* **authentication,chat,email,forms,push-notifications,sms,storage:** config types([#148](https://github.com/ConduitPlatform/Conduit/issues/148)) ([eeaaf2c](https://github.com/ConduitPlatform/Conduit/commit/eeaaf2c9771245464edf96578487f6506fbbed7d))
* **authentication,chat:** return types and naming consistencies ([138a40a](https://github.com/ConduitPlatform/Conduit/commit/138a40a6d205cd6cf753d57b4c5ae0f14a9ff9fc))
* **authentication:** replace hardcoded Conduit url ([#135](https://github.com/ConduitPlatform/Conduit/issues/135)) ([f26854e](https://github.com/ConduitPlatform/Conduit/commit/f26854e41488818e0c30ad528b17d7b34d8ef7db))
* **authentication:** wrong errors thrown in validation ([#188](https://github.com/ConduitPlatform/Conduit/issues/188)) ([25fe60d](https://github.com/ConduitPlatform/Conduit/commit/25fe60d38c48e6f2f232f3f8b6b141f74cf51a82))
* **chat:** add uuid missing dependency ([65eaa04](https://github.com/ConduitPlatform/Conduit/commit/65eaa04d8f96f3b8688f71212edbe98d2b4d64d5))
* **commons,config,core,router,admin,security:** config update ([#131](https://github.com/ConduitPlatform/Conduit/issues/131)) ([3f224b4](https://github.com/ConduitPlatform/Conduit/commit/3f224b4ac7d6fd179768590a2de4c885c432af10))
* **config,grpc-sdk:** updateModuleHealth() not reregistering removed modules ([#163](https://github.com/ConduitPlatform/Conduit/issues/163)) ([3075e06](https://github.com/ConduitPlatform/Conduit/commit/3075e06ea8c79c020e0d23ef78b5526600ad2a86))
* **database:** array type not extracted properly ([#182](https://github.com/ConduitPlatform/Conduit/issues/182)) ([7cb2546](https://github.com/ConduitPlatform/Conduit/commit/7cb25460f22a6ad6ab37c47f4005c5db34cfb607))
* **database:** crud ops migration ([6cf7070](https://github.com/ConduitPlatform/Conduit/commit/6cf7070187a66f86f216f8bb824b9fc397b083a5))
* **database:** crudOperations migration fixed ([#181](https://github.com/ConduitPlatform/Conduit/issues/181)) ([259b0d1](https://github.com/ConduitPlatform/Conduit/commit/259b0d15cf50e2272458bd4485edcabe542dcc29))
* **database:** database module triggers introspection on unpopulated dbs ([#169](https://github.com/ConduitPlatform/Conduit/issues/169)) ([e55fb56](https://github.com/ConduitPlatform/Conduit/commit/e55fb56f5c40419dcb61fb3f9e4bdd6016df555a))
* **database:** fix casing for mongo ObjectId types in type extraction ([#190](https://github.com/ConduitPlatform/Conduit/issues/190)) ([c10dc38](https://github.com/ConduitPlatform/Conduit/commit/c10dc381ba8bbedeade2deb030ff33128d1527ba))
* **database:** get pending query params not parsed, add search param ([#168](https://github.com/ConduitPlatform/Conduit/issues/168)) ([9e5e266](https://github.com/ConduitPlatform/Conduit/commit/9e5e266d990714abe73e1f541154a24af50ee896))
* **database:** pending schemas import safe defaults in finalizeSchemas() ([#191](https://github.com/ConduitPlatform/Conduit/issues/191)) ([5ff94df](https://github.com/ConduitPlatform/Conduit/commit/5ff94df25b265222ec12f0a816e236f7e3edbf66))
* **database:** put crud operation not properly checked ([#189](https://github.com/ConduitPlatform/Conduit/issues/189)) ([5dbbf55](https://github.com/ConduitPlatform/Conduit/commit/5dbbf55a37b472a1eeaa625e516087c630eb2fb9))
* **grpc-sdk:** wrapRouterFunctions request logging ([#155](https://github.com/ConduitPlatform/Conduit/issues/155)) ([71cbb66](https://github.com/ConduitPlatform/Conduit/commit/71cbb66044b6451922f98031e6c0652c03d4484b))
* node types ([#185](https://github.com/ConduitPlatform/Conduit/issues/185)) ([3afc6eb](https://github.com/ConduitPlatform/Conduit/commit/3afc6ebc2e3b63f2116d33c127f7f33991fb5c8f))
* **router:** get middlewares route bug fixed ([#153](https://github.com/ConduitPlatform/Conduit/issues/153)) ([87351b5](https://github.com/ConduitPlatform/Conduit/commit/87351b52468c8eabe9ab77ac30913712c44418d4))
* **router:** moment missing dependency ([5b3667c](https://github.com/ConduitPlatform/Conduit/commit/5b3667c600179970b1f58eefee59b28448afa2df))
* **security:** client validation check routing bug ([7ca4fa9](https://github.com/ConduitPlatform/Conduit/commit/7ca4fa9a670f883041a39626ae87cc1442ed71a8))
* **security:** domain regex checks ([#156](https://github.com/ConduitPlatform/Conduit/issues/156)) ([045419b](https://github.com/ConduitPlatform/Conduit/commit/045419b6333b897dfd4fa523e6727b2362a931b7))
* **security:** regex validation issue ([#149](https://github.com/ConduitPlatform/Conduit/issues/149)) ([5465779](https://github.com/ConduitPlatform/Conduit/commit/54657795d41047bb7e502c877d3b385b1673017e))
* **security:** specific case for domain ([#157](https://github.com/ConduitPlatform/Conduit/issues/157)) ([ef1d0db](https://github.com/ConduitPlatform/Conduit/commit/ef1d0db83ccc4b2d72a5701af856580d54ddddec))


*  feat(core,config,commons,grpc-sdk,database)!: implement gRPC health check protocol ([efbd0b0](https://github.com/ConduitPlatform/Conduit/commit/efbd0b0ccecc66a83dd73a7cbbc2d8204ee73e42))

### [0.12.6](https://github.com/ConduitPlatform/Conduit/compare/v0.12.5...v0.12.6) (2022-04-13)

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
