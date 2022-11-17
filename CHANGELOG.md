# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
