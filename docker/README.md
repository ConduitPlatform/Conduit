
# Trying out Conduit

## Initial Setup

``` bash
source <(curl -s https://raw.githubusercontent.com/ConduitPlatform/Conduit/master/docker/get-conduit.sh)
```

Running the above should put together a basic Conduit installation using OCI containers on your machine.<br />
This is also going to download a Makefile in your current directory.<br />
You may use that to control your Conduit environment. More on that below.

The default configuration is going to bring up the following:

- Conduit Core
- Database Module
- Authentication Module
- CMS Module
- Conduit Administration Panel

That's it. Conduit is already running!<br />
Once the configuration is complete, you'll be able to access the administration panel through [http://localhost:8080](http://localhost:8080).

## Makefile Usage

Start by heading to the directory of your Makefile if you're currently in a different filesystem path.<br />
Note how you may freely move your Makefile anywhere you wish and it should still continue to function.

There are multiple ways to start Conduit, depending on which modules you wish to bring online.<br />

``` bash
make start-conduit # starts Conduit, Database, Authentication, CMS, Administration Panel
make start-core    # only starts Conduit
```

Regarless of which option you choose, you may always just start and stop additional modules whenever you feel like it.

### Starting Modules
``` bash
make start-module # eg: make start-email
```

### Stopping Modules
``` bash
make stop-module # eg: make stop-email
```

|   Commands         |   Description                                                       |
| :----------------- | :------------------------------------------------------------------ |
| setup              | Bootstraps a local Conduit installation                             |
| start-conduit      | Starts Conduit, Database, Authentication, CMS, Administration Panel |
| zero-to-hero       | Runs `setup` and `start-conduit` at the same time                   |
| start-all          | Starts all containers                                               |
| stop-all           | Stops all containers                                                |
| start-`target`     | Starts target container                                             |
| stop-`target`      | Stops target container                                              |
| rm-`target`        | Removes target container                                            |
| rmi-`target`       | Removes target container image                                      |
| clean              | Removes containers                                                  |
| mrproper           | Removes containers, images, network                                 |

Here's a list of the main module `targets` you can *start*, *stop*, *rm* and *rmi* individually:

- core
- ui
- database
- authentication
- cms
- chat
- email
- forms
- push-notifications
- sms
