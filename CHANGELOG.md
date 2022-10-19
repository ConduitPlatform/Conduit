# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.10.14](https://github.com/ConduitPlatform/Conduit/compare/v0.10.12...v0.10.14) (2022-10-19)


### Features

* **grpc-sdk:** add urlRemap for local development ([2b35928](https://github.com/ConduitPlatform/Conduit/commit/2b359280eb7b864dcf730b74988b626de46f5be7))


### Bug Fixes

* publish to npm ([a820bb8](https://github.com/ConduitPlatform/Conduit/commit/a820bb8967934a450a97c5b1f2e2063ad6c110ba))

### [0.10.14](https://github.com/ConduitPlatform/Conduit/compare/v0.10.13...v0.10.14) (2022-10-19)


### Bug Fixes

* publish to npm ([a820bb8](https://github.com/ConduitPlatform/Conduit/commit/a820bb8967934a450a97c5b1f2e2063ad6c110ba))

### [0.10.13](https://github.com/ConduitPlatform/Conduit/compare/v0.10.12...v0.10.13) (2022-10-19)


### Features

* **grpc-sdk:** add urlRemap for local development ([2b35928](https://github.com/ConduitPlatform/Conduit/commit/2b359280eb7b864dcf730b74988b626de46f5be7))

### [0.10.12](https://github.com/ConduitPlatform/Conduit/compare/v0.10.11...v0.10.12) (2022-07-15)


### Bug Fixes

* **database:** createWithPopulations looking for wrong properties ([7b2501e](https://github.com/ConduitPlatform/Conduit/commit/7b2501e87025f8903f9ea01524dbb36e6630679c))

### [0.10.11](https://github.com/ConduitPlatform/Conduit/compare/v0.10.10...v0.10.11) (2022-07-13)


### Bug Fixes

* **authentication:** build failure due to python in alpine ([0e4f528](https://github.com/ConduitPlatform/Conduit/commit/0e4f5285b52f93815a4b275207a71f27f15e27ae))

### [0.10.10](https://github.com/ConduitPlatform/Conduit/compare/v0.10.9...v0.10.10) (2022-07-13)


### Bug Fixes

* **chat:** missing error handling on grpc functions ([6858611](https://github.com/ConduitPlatform/Conduit/commit/6858611a6062362c982c587c194caacd2907e64c))

### [0.10.9](https://github.com/ConduitPlatform/Conduit/compare/v0.10.8...v0.10.9) (2022-04-04)


### Bug Fixes

* **router:** socket emits ([#110](https://github.com/ConduitPlatform/Conduit/issues/110)) ([91ebfb3](https://github.com/ConduitPlatform/Conduit/commit/91ebfb380552a763acd7d73ce59f0a9f1cc4eda4))

### [0.10.8](https://github.com/ConduitPlatform/Conduit/compare/v0.10.7...v0.10.8) (2022-03-28)


### Bug Fixes

* **grpc-sdk:** backport module-name call metadata ([135ca3f](https://github.com/ConduitPlatform/Conduit/commit/135ca3feee82b2fa18fc746f28e2e4a2db4e5bcb))
* **router:** backport socket fixes ([c584653](https://github.com/ConduitPlatform/Conduit/commit/c584653974b997df33fb7940e91e56548476de25))

### [0.10.6](https://github.com/Quintessential-SFT/conduit/compare/v0.10.5...v0.10.6) (2021-12-06)


### Features

* **chat:** populate added at getMessages also. [#1](https://github.com/Quintessential-SFT/conduit/issues/1)td8cvz ([e63630c](https://github.com/Quintessential-SFT/conduit/commit/e63630c7a594cd7d1ae883920bb69b8d4f7d8c96)), closes [#1td8](https://github.com/Quintessential-SFT/conduit/issues/1td8)
* **database:** drop collection of custom schemas [#1](https://github.com/Quintessential-SFT/conduit/issues/1)u9r11e ([3944e77](https://github.com/Quintessential-SFT/conduit/commit/3944e77726f069c760dbdc39b0ab6843a4f779f7)), closes [#1u9r11](https://github.com/Quintessential-SFT/conduit/issues/1u9r11)


### Bug Fixes
* **security:** secret migration not using the proper regex ([c05843d7](https://github.com/Quintessential-SFT/conduit/pull/486/commits/c05843d761b8abcdf81f7e4de48bb309feb86df8))
* **grpc-sdk:** chat not exporting send message ([7a80040](https://github.com/Quintessential-SFT/conduit/commit/7a80040945698e639c10382e006eef044ee44916))
* **authentication:** searching with id now is supported ([c03fe4c](https://github.com/Quintessential-SFT/conduit/commit/c03fe4c06218c69f52153d11c09808f0ee7922ef))
* **auth:** was searching by wrong field. ([512259a](https://github.com/Quintessential-SFT/conduit/commit/512259a05611b2c6960a34981c5f23be0c63aafc))
* **build-errors:** fixed 3 build errors ([7cb467f](https://github.com/Quintessential-SFT/conduit/commit/7cb467fad68dc229e2281b3e0f687e4e8e629cdf))
* change layout label prop signature to only accept objects ([4613fac](https://github.com/Quintessential-SFT/conduit/commit/4613fac1789ad428e254391b1dfb6f2489a8d1e6))
* **chat:** constant rename ([0425019](https://github.com/Quintessential-SFT/conduit/commit/0425019980bf3302c6e21ddcb2c09f56fc1acd51))
* **chat:** folderName handling ([f52d674](https://github.com/Quintessential-SFT/conduit/commit/f52d674ed316d33f910a2789c8d3cbb1839fc113))
* **chatimplementation-of-select:** fixed to properly work with the new way of receiving details ([8e4357b](https://github.com/Quintessential-SFT/conduit/commit/8e4357bba87d7a0b1db7958c4276338c1f084f74))
* **chat:** invalid value of totalCount while using search variable [#1](https://github.com/Quintessential-SFT/conduit/issues/1)tjtwht ([cbd60c8](https://github.com/Quintessential-SFT/conduit/commit/cbd60c8575ddf3618eb6274101ca644264d7c948))
* **chat:** missing comment ([213e194](https://github.com/Quintessential-SFT/conduit/commit/213e19420d561322b7691f4de01e6dde7c6f8dec))
* **chat:** reset chat panel data when navigating ([c84d2b3](https://github.com/Quintessential-SFT/conduit/commit/c84d2b339ba54096e972b96cdce82ced130d02ee))
* **ChatRoomTabs:** removed redundant return statement ([287b430](https://github.com/Quintessential-SFT/conduit/commit/287b430c20f277643037faed5d38f951b5ffa988))
* **chat:** search ([827b763](https://github.com/Quintessential-SFT/conduit/commit/827b763194429005af60d2ffe40a54f867330f6e))
* **chat:** sonar cloud fixes ([fbecb11](https://github.com/Quintessential-SFT/conduit/commit/fbecb111bfa14f22266d8665482ea36069781245))
* **chat:** tab styling ([d5d80d9](https://github.com/Quintessential-SFT/conduit/commit/d5d80d9fcef19213f6e4516df82636e720f128f0))
* **cms:** prettier ([521c6a8](https://github.com/Quintessential-SFT/conduit/commit/521c6a837c93c80091502721cbeb28b72ec3a196))
* **codeSmell:** fixed requested codeSmell ([0e27641](https://github.com/Quintessential-SFT/conduit/commit/0e2764168da7042a72af3b5facc6040f41be8460))
* **config-hook-form:** added layout ([d882716](https://github.com/Quintessential-SFT/conduit/commit/d882716e22c999fe652ef5752196089a21fe1289))
* **config:** await was missing when a setConfig function was being  called. ([15f3ef6](https://github.com/Quintessential-SFT/conduit/commit/15f3ef60071b4db3be5ad2936ff833ee69912475))
* **conflicts:** & Merge branch 'master' of https://github.com/Quintessential-SFT/conduit into drawer-wrapper-refactor ([3d7edd4](https://github.com/Quintessential-SFT/conduit/commit/3d7edd4f7533b1a0e815a466c72abea0148e0677))
* **core:** package naming to match other packages ([1daf102](https://github.com/Quintessential-SFT/conduit/commit/1daf1026cdf95a94aea8b602f711859c152c3ac0))
* **create&editform:** correct regexp to dissallow spaces on form name ([16c710e](https://github.com/Quintessential-SFT/conduit/commit/16c710e8416f3432e7a0994ac5a24adb3b9baca8))
* **customerForm:** display user email/name instead of _id ([970283a](https://github.com/Quintessential-SFT/conduit/commit/970283a82479aeca0cd8d72f46c339ab98118ba2))
* **customerForm:** implementation of singleSelect on customerForm ([1f55ed5](https://github.com/Quintessential-SFT/conduit/commit/1f55ed540f4fa4e36a8be63ad112245731d499bf))
* **data-table-sorting:** no labels when sorting === false && fixed sorting ([7a5f922](https://github.com/Quintessential-SFT/conduit/commit/7a5f92274afe3e6e2bd3374e5be506a0ba071860))
* **database:** bump mongoose to 5.13.13 to fix package vulnerabilities ([04fb96b](https://github.com/Quintessential-SFT/conduit/commit/04fb96b551d26562dc9cf42a0fc598ca62161e36))
* **database:** deleteSchema() converted to async ([913c148](https://github.com/Quintessential-SFT/conduit/commit/913c148d61af02cf8e3ceabea9f006f3ea213ea6))
* **database:** schema also deleted from declaredSchemas ([483baa9](https://github.com/Quintessential-SFT/conduit/commit/483baa904d236cef67bc75be491b2ec2043a8323))
* **dataTable:** remove useState ([c449a6c](https://github.com/Quintessential-SFT/conduit/commit/c449a6c1a7dae198c8395519bba5d5f94b37b315))
* **dataTableSize:** default to denser tables ([d19c1cc](https://github.com/Quintessential-SFT/conduit/commit/d19c1ccc7ad40ce639583c7ab664e4ce29611a3d))
* **dataTable:** unused imports and self closing table cell ([61ef4e3](https://github.com/Quintessential-SFT/conduit/commit/61ef4e3d1c867f4ba2c9ad20e5e9d8de09edfb46))
* **dockerfiles:** build process for core and admin ([955f8ef](https://github.com/Quintessential-SFT/conduit/commit/955f8eff4e8548b428a960767fa4e8b99cf191f6))
* **drawer-buttons:** placed correctly ([4442a20](https://github.com/Quintessential-SFT/conduit/commit/4442a2001446ca39bcb95d0020db43a03c1de320))
* **drawers:** add a persistent title for consistency ([86dfa66](https://github.com/Quintessential-SFT/conduit/commit/86dfa66210f8fa33f8f4a48bf67a27af3e5311b2))
* **editForm:** fixes sonarclound duplicate import ([4d7c549](https://github.com/Quintessential-SFT/conduit/commit/4d7c549c6926ce6c3572c645a86443184edf4e8e))
* **email:** Dockerfile ([7d67c59](https://github.com/Quintessential-SFT/conduit/commit/7d67c598fc2158c53d620df4f7181c09fcd2af92))
* **emails:** compose email variables, proper tabs, external template body on editor ([a8221cc](https://github.com/Quintessential-SFT/conduit/commit/a8221cc71f9c989a19fee811ee3f7b42dfc94e6e))
* **email:** searching with id now is supported ([db58053](https://github.com/Quintessential-SFT/conduit/commit/db580536a9d4c616ef63f770aa3e03a76dcb323d))
* **emailsettings:** proper name ([2b103f2](https://github.com/Quintessential-SFT/conduit/commit/2b103f2608fac0c4206cc571a3a00d7010f97bda))
* **email:** totalCount return value fixed. ([b12b3a2](https://github.com/Quintessential-SFT/conduit/commit/b12b3a201521aa274829e2ac8ee284ca610c6159))
* **endpointNames:** proper enpoint names without hyphen ([fdd8cc1](https://github.com/Quintessential-SFT/conduit/commit/fdd8cc1663e321dcb0264d372693b74b96dab705))
* **FormInputText:** redundant boolean ([136e067](https://github.com/Quintessential-SFT/conduit/commit/136e067971b6f07a366f5ddf7e10461addada627))
* **github:** builds running on PRs ([c5b6f16](https://github.com/Quintessential-SFT/conduit/commit/c5b6f16dc88be6c73f15d5ab9d7e8980d5306504))
* **github:** remove document action from build ymls ([678765a](https://github.com/Quintessential-SFT/conduit/commit/678765a80a6d6c2027500a26b6a54caeb5b39b70))
* **httpModels:** made a new folder and moved typically used types for requests ([841b62b](https://github.com/Quintessential-SFT/conduit/commit/841b62b98433e532966885502ef2b36db99952f1))
* **imports:** some unused imports ([b18cb58](https://github.com/Quintessential-SFT/conduit/commit/b18cb581c292ff253d2aed4994b2849cbbffbc9b))
* **indeterminate&layout:** indeterminate deselected after deletion and better names on the layout ([13a910a](https://github.com/Quintessential-SFT/conduit/commit/13a910acb7921b366da1dbbe73d06cf711bc8958))
* inner layout router function ([33995dd](https://github.com/Quintessential-SFT/conduit/commit/33995dde8d3866ccf61b0f06295160a584eebac3))
* layout styling ([4e9d0af](https://github.com/Quintessential-SFT/conduit/commit/4e9d0afab10554b654187c334070027508a5d379))
* **makefile:** missing space ([9dbd3ac](https://github.com/Quintessential-SFT/conduit/commit/9dbd3ac6be7d2ec651cb37a60f4e0171ec7b97ec))
* **makefile:** storage and email builds ([4630d48](https://github.com/Quintessential-SFT/conduit/commit/4630d4888014d93654248651a29fd9ffcbc5afca))
* **nextJsImporterror:** used eslint rule to avoid unwanted behaviour ([dd779ef](https://github.com/Quintessential-SFT/conduit/commit/dd779ef2c4bc0a2942e93d14063600ab3c764b63))
* **notificationSettings&send:** Proper configuration ([a0ff02f](https://github.com/Quintessential-SFT/conduit/commit/a0ff02f09f3b552bd0dd157d84b208b16986b71b))
* **notificationSettings:** now we properly get the settings data ([46c991e](https://github.com/Quintessential-SFT/conduit/commit/46c991efd1158b7c860785b0a95af7df4f6f8619))
* **notificationSettings:** types where needed ([b3b112d](https://github.com/Quintessential-SFT/conduit/commit/b3b112d79c1bfcd10fdb715bc9e1883f354b9b85))
* **notifications:** fix requested types ([d18b0dd](https://github.com/Quintessential-SFT/conduit/commit/d18b0dd589299c89545401b3240e248594c517f2))
* **payment-settings&swagger:** proper edit and link ([228562d](https://github.com/Quintessential-SFT/conduit/commit/228562d50af9387aec57b539b37a8974b3441701))
* **paymentforms:** fix code smells ([676f2c3](https://github.com/Quintessential-SFT/conduit/commit/676f2c358a7273bf0171ba494a34f8571572ff7b))
* **paymentForms:** fix merge conflicts & Merge branch 'master' of https://github.com/Quintessential-SFT/conduit into rhf-payments ([037cf92](https://github.com/Quintessential-SFT/conduit/commit/037cf92722716f56b13af4e7ae2e12b6a0dc3add))
* **paymentForms:** fix requested changes, types ([9bb536e](https://github.com/Quintessential-SFT/conduit/commit/9bb536ed7b9ba3dc151d03c515a333164e7ec1f3))
* **push-notifications:** missing comment ([1f0b451](https://github.com/Quintessential-SFT/conduit/commit/1f0b4518e65079c60ffbd4cfb6ff7feb634366a4))
* **react-hook-form:** Added rhf to storage settings ([24a52b3](https://github.com/Quintessential-SFT/conduit/commit/24a52b36c1364682782c5d789cfe262892d8cfd9))
* **remove-log:** removed console log ([daf181e](https://github.com/Quintessential-SFT/conduit/commit/daf181e3f9279c3aae986e0a2367427b55b2a4f4))
* **requests-config:** removed unnecessary check ([246f257](https://github.com/Quintessential-SFT/conduit/commit/246f257226852e8e41f3e59db5f3704affab3400))
* reset table data when navigating ([8d2a543](https://github.com/Quintessential-SFT/conduit/commit/8d2a543681c5bd980df8a3e262b2faefe5e4649e))
* **rhfForms:** required changes ([872511d](https://github.com/Quintessential-SFT/conduit/commit/872511dfdc8accef851d5d774a0265fb0ee1fccf))
* **sanitization:** moved sanitize on request interceptors ([54e8e7c](https://github.com/Quintessential-SFT/conduit/commit/54e8e7ca3e95df37020776c51fed1901a1952626))
* **sanitizeParams:** param sanitization on most tables & added types for common cases like pagination ([c45be26](https://github.com/Quintessential-SFT/conduit/commit/c45be268c7904080339510f910bf5d9080a97895))
* **sanitize:** proper types for pagination ([d8fec7e](https://github.com/Quintessential-SFT/conduit/commit/d8fec7ed9d26366d36bd3f3789d40d0eaa1530ba))
* **schemas-table:** proper way to handle visible-data ([f663178](https://github.com/Quintessential-SFT/conduit/commit/f6631782d1fe5d00d48478cdbe7e303485071b2b))
* **schemas:** multiple selection works properly ([e121944](https://github.com/Quintessential-SFT/conduit/commit/e121944dead900740a2292b2c434a16a93e61a47))
* **schemas:** null check to visible schemas ([1cc7884](https://github.com/Quintessential-SFT/conduit/commit/1cc7884442ea25dbd86f7cc94e033d13d1b4f28c))
* **selectable-elements-table:** we can now retrieve every value the table has, not only the _id ([3a6f4d9](https://github.com/Quintessential-SFT/conduit/commit/3a6f4d9432b35dcce2e43eec87d5496b40f0d192))
* **selected-elements:** now we show any kind of info we want like name, email etc ([4e9d4ef](https://github.com/Quintessential-SFT/conduit/commit/4e9d4eff746ad719373decbc446f945ecd32ed0b))
* **sendEmailForm:** fixed an empty expression ([39a580c](https://github.com/Quintessential-SFT/conduit/commit/39a580c1864f3194ae050c1802ba22bee3c257a4))
* **sendEmailForm:** fixed sonarcloud issue ([20c9110](https://github.com/Quintessential-SFT/conduit/commit/20c9110928317cea52fe0457c454f155ebd924e7))
* **showDrawerData:** remove __v and format dates ([69dc250](https://github.com/Quintessential-SFT/conduit/commit/69dc2502d2476800873330b6409b8c84c25571d4))
* **single-selection:** added prop for single selection ([093b178](https://github.com/Quintessential-SFT/conduit/commit/093b17826d933219df215a9d7c19e25b6f3ba988))
* **sonar-cloud-bug:** turned while iteration to if ([e2958eb](https://github.com/Quintessential-SFT/conduit/commit/e2958eb2f52c1005fc9e4c19f10472f4d627f65a))
* **sonar-cloud-smells:** unused imports ([9173274](https://github.com/Quintessential-SFT/conduit/commit/9173274be30946cee8c96941271de96727a87fc0))
* **storage settings switch:** added state to the switch to change accordingly ([a17c2cc](https://github.com/Quintessential-SFT/conduit/commit/a17c2ccc86020975a1cc22066e52a66cbecd35da))
* **storage-settings:** proper handling of the config ([7afd455](https://github.com/Quintessential-SFT/conduit/commit/7afd4552435ea76b6b051418b24c0e94cd815065))
* **storage-settings:** removed not needed file ([7eaea17](https://github.com/Quintessential-SFT/conduit/commit/7eaea17c76ef85f79af599d79bbc615e10156ca4))
* **storage-settings:** requested changes ([f42cb7d](https://github.com/Quintessential-SFT/conduit/commit/f42cb7d596970f550a92d85e374bad36708c4b92))
* **storage-settings:** styling fixes ([53454e7](https://github.com/Quintessential-SFT/conduit/commit/53454e7ce3692214cf1303fb34893aec1af67666))
* **storage:** "/" character not clickable on path ([d3275ca](https://github.com/Quintessential-SFT/conduit/commit/d3275ca94111e92ba247ce725ee72e70c088829f))
* **storage:** current container no longer empty as default value ([66dc142](https://github.com/Quintessential-SFT/conduit/commit/66dc142fc44b0e934fe1920b631bb7896f0a840e))
* **storage:** get folder param name fix ([ca4e77c](https://github.com/Quintessential-SFT/conduit/commit/ca4e77cc5f39c5820fc4368efeefa7140e007d5e))
* **storage:** handle folder name when creating new one ([aa29899](https://github.com/Quintessential-SFT/conduit/commit/aa29899ad99a43a49dcb2eae7d6849e8123b6122))
* **storage:** regex fixed for finding child folders at getFolders() ([b42b5a9](https://github.com/Quintessential-SFT/conduit/commit/b42b5a9eadfe8a6369e64020a6ccd3d4ec1a3945))
* **storage:** remove redundant return ([487a8d9](https://github.com/Quintessential-SFT/conduit/commit/487a8d93c5cf6718881e59eab568e001ec62da22))
* **storage:** update data when deleting container/folder/file ([67a8729](https://github.com/Quintessential-SFT/conduit/commit/67a87292325d7bcc19ff60193c588a9a5db7f5e6))
* **swaggerlink:** swagger redirects to forms now ([af86b39](https://github.com/Quintessential-SFT/conduit/commit/af86b394fb7c048b7a1fdb6c4122a1f18c9be6dc))
* **swagger:** proper notifications swagger ([2ce7907](https://github.com/Quintessential-SFT/conduit/commit/2ce79079a1016ac2d8757f59861505e0efbe2ecc))
* **table-density:** option to change density & clearer imports on dataTable ([1f5738c](https://github.com/Quintessential-SFT/conduit/commit/1f5738ccfa59594fea2a9f7037c40e8ab3ea6c90))
* **tablesSearch:** properly reset page when searching/filtering ([76287dd](https://github.com/Quintessential-SFT/conduit/commit/76287dd384a5ce22cf50d9980cb30e2160ef3f31))

### [0.10.5](https://github.com/Quintessential-SFT/conduit/compare/v0.10.4...v0.10.5) (2021-11-16)


### ⚠ BREAKING CHANGES

* client secrets are now encrypted in the DB

### Features

* **cms:** implement deleteManySchemas(), toggleMany() ([904aa38](https://github.com/Quintessential-SFT/conduit/commit/904aa38e7241b1ed0a04d23513d6f3571735167d))
* **database:** findByIdAndUpdate() populate param ([f383997](https://github.com/Quintessential-SFT/conduit/commit/f38399789796b6f941b486408325c9feed7506a1))
* **database:** populate support at sequalizeSchema at findByIdAndUpdate ([b3a1574](https://github.com/Quintessential-SFT/conduit/commit/b3a1574724c008b3c5045a5cac1dfa71c420b2f3))


### Bug Fixes

* **authentication:** getUsers search variable ([32c04d1](https://github.com/Quintessential-SFT/conduit/commit/32c04d1d2cf559e0967b7516d5877fcb7e1d464a))
* **authentication:** minor fix ([b621afd](https://github.com/Quintessential-SFT/conduit/commit/b621afd7b2476f3ea9aa24e90b75793350cfdac4))
* **authentication:** package.json update ([6604057](https://github.com/Quintessential-SFT/conduit/commit/6604057fd1563e331e654405c87eddb405f4ec1f))
* **chat:** logs ([54d2ce3](https://github.com/Quintessential-SFT/conduit/commit/54d2ce3ca5e05db8bed01ef2f91f0cfa7388c389))
* **chat:** ret value changed at delete operations ([45e106b](https://github.com/Quintessential-SFT/conduit/commit/45e106b89358cda68df797da6c7d908a1cbe4ba2))
* **database:** minor fix ([2074352](https://github.com/Quintessential-SFT/conduit/commit/2074352d0997401b2dd35593be0a5f8de6792d4f))
* **database:** populate type ([74bdd05](https://github.com/Quintessential-SFT/conduit/commit/74bdd05e6f728875f35ae612b0f4ac82dffc366f))
* **database:** populate variable checking ([ab59d0a](https://github.com/Quintessential-SFT/conduit/commit/ab59d0a932334a12173c507cc0f6febb7a273d1c))
* **forms:** createForm() and editFormById() not accepting Date and Number fields, triple-stash html data values in FormSubmissionTemplate ([8c0ee28](https://github.com/Quintessential-SFT/conduit/commit/8c0ee28fb8a56148ed6f29f36e0dee613b63973f))
* **github:** missing email provider dependency in email module action ([904442e](https://github.com/Quintessential-SFT/conduit/commit/904442e6d45778097749aba358e082678e04c385))
* **pushNotifications:** delete logs ([5a32571](https://github.com/Quintessential-SFT/conduit/commit/5a32571533e3675b736cf7e5a47900d82334ea71))
* **pushNotifications:** name of  module changed ([8b74967](https://github.com/Quintessential-SFT/conduit/commit/8b7496719d9f7bb00897bdc27b5e29abad0bc82a))
* **pushNotifications:** name of  module changed ([ab054ff](https://github.com/Quintessential-SFT/conduit/commit/ab054ff3cc9e0da8f1cfaf85e0e47c414107c00a))
* **pushNotifications:** name of  module changed ([34156bc](https://github.com/Quintessential-SFT/conduit/commit/34156bcf05ea2ab683751fc67dd79e027a95c1d1))
* **storage:** checking for '/' existance [#1](https://github.com/Quintessential-SFT/conduit/issues/1)p68x6j ([119325b](https://github.com/Quintessential-SFT/conduit/commit/119325b2952e353503a3e900784a97b568e56c1d)), closes [#1p68x6](https://github.com/Quintessential-SFT/conduit/issues/1p68x6)
* **storage:** checking for '/' existance in deleteFolder(),getFiles() [#1](https://github.com/Quintessential-SFT/conduit/issues/1)p68x6j ([5024ce5](https://github.com/Quintessential-SFT/conduit/commit/5024ce5c05ecc7de1687f3f1c3ce364f12b6c623)), closes [#1p68x6](https://github.com/Quintessential-SFT/conduit/issues/1p68x6)


* refactor!(security):  encrypt client secrets ([a00e9e5](https://github.com/Quintessential-SFT/conduit/commit/a00e9e52bb72804b1355dad460f7a7ef845e455e))
