# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
