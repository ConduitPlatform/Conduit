<a href="https://getconduit.dev" target="_blank"><img src=".github/assets/conduit-ui-dashboard.png" alt="logo"/></a>
<hr />
<p align="center">
    <a href="https://www.codefactor.io/repository/github/conduitplatform/conduit">
        <img src="https://img.shields.io/codefactor/grade/github/conduitplatform/conduit?logo=codefactor&style=for-the-badge&labelColor=000000" alt="CodeFactor Badge"/>
    </a>
    <a href="https://github.com/ConduitPlatform/Conduit/releases">
        <img src="https://img.shields.io/github/v/release/ConduitPlatform/Conduit?color=green&sort=semver&style=for-the-badge&labelColor=000000" alt="Latest SemVer Release"/>
    </a>
    <a href="https://github.com/ConduitPlatform/Conduit/commits/main">
        <img src="https://img.shields.io/github/commit-activity/m/ConduitPlatform/Conduit?style=for-the-badge&labelColor=000000" alt="Commit Activity"/>
    </a>
    <a href="https://discord.com/invite/fBqUQ23M7g">
        <img src="https://img.shields.io/discord/938737566365126707?label=discord&style=for-the-badge&logo=discord&labelColor=000000&logoWidth=20" alt="Discord Server"/>
    </a>
</p>

Conduit is a self-hosted backend aiming to cut down development times by providing common functionality through ready-made modules, while offering maximum flexibility through extensions and custom modules.

Why write and debug the same boilerplate code for every project when you can focus on implementing the features that genuinely matter for your unique application.<br />
Conduit takes care of all the tedious tasks that come with developing a backend from scratch, allowing you to spend your time building APIs that are going to properly support your project's needs and make it stand out.

# Getting Started ✨

We built a CLI to help you conveniently spin up local Conduit deployments among other interesting things.

``` bash
# Install Conduit CLI and setup a local deployment:
sh <(curl -s https://getconduit.dev/bootstrap)
```

<p align="center"><strong>👉 Make sure <a href="https://www.docker.com">Docker</a> and <a href="https://docs.docker.com/compose/install">Docker Compose</a> are available. 👈</p></strong>
<p align="center"><strong>⚠️ Windows users are currently expected to use the CLI through WSL. ⚠️</strong></p>

Once your deployment is ready, your web browser will automatically redirect you to your administration dashboard.<br />
Depending on your environment, it may take a few seconds for the page to become responsive.

Default Credentials: `admin`/`admin`.<br />
Once logged-in, you may check out your APIs' generated route documentation through the `Swagger` and `GraphQL` elements.

<p align="center"><a href="https://getconduit.dev/docs/cli">Find out more regarding Conduit's CLI</a></p>

# Documentation 📖

If you're only just starting out with Conduit, make sure you familiarize yourself with the project by checking out [our docs](https://getconduit.dev/docs/overview/intro).

Can't find what you're interested in? Shoot us a message [on Discord](https://discord.com/invite/fBqUQ23M7g) and we'll help you out.

# Modules 🧩

- [Authentication](https://getconduit.dev/docs/modules/authentication) - Authenticate your users using a plethora of sign-in methods.
- [Authorization](https://getconduit.dev/docs/modules/authorization) - Configure resource authorization rules that meet your needs.
- [Chat](https://getconduit.dev/docs/modules/chat) - Build realtime chat applications.
- [Database](https://getconduit.dev/docs/modules/database) - Create schemas with auto-generated CRUD and Query-based functional endpoints. Supports MongoDB and PostgreSQL.
- [Email](https://getconduit.dev/docs/modules/email) - Send emails using multiple supported providers.
- [Forms](https://getconduit.dev/docs/modules/forms) - Submit forms and have responses forwarded to an email address.
- [PushNotifications](https://getconduit.dev/docs/modules/push-notifications) - Send push notifications to your users.
- [Router](https://getconduit.dev/docs/modules/router) - Seamlessly expose REST, GraphQL and WebSockets APIs with auto-generated endpoint documentation.
- [SMS](https://getconduit.dev/docs/modules/sms) - Send text messages and expand user authentication with 2FA.
- [Storage](https://getconduit.dev/docs/modules/storage) - Online storage using multiple cloud providers.

# Running from Source 🔨

Find out how to build and run Conduit from source in the [Development Setup](https://github.com/ConduitPlatform/Conduit/blob/main/.github/CONTRIBUTING.md#development-setup-) section.

# Roadmap 🏁

Wanna see what comes next?
[Here](https://sharing.clickup.com/1554325/b/h/1fdwn-7561/8b09d2e9aedec0b)'s some of the stuff we're working on behind the scenes.

# Contributing ❤️

We built Conduit cause we felt like none of the already available options seemed right for our needs.<br />
Then we made it open-source so that everyone can use and extend it however they see fit.

If you enjoy building awesome things and want to support the project, check out our [Contributing Guide](https://github.com/ConduitPlatform/Conduit/blob/main/.github/CONTRIBUTING.md) to find out how to get started.
