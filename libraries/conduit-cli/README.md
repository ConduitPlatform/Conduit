conduit-cli
===========

The CLI to help you when developing conduit

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/conduit-cli.svg)](https://npmjs.org/package/conduit-cli)
[![Downloads/week](https://img.shields.io/npm/dw/conduit-cli.svg)](https://npmjs.org/package/conduit-cli)
[![License](https://img.shields.io/npm/l/conduit-cli.svg)](https://github.com/quintessential-sft/conduit/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g conduit-cli
$ conduit COMMAND
running command...
$ conduit (-v|--version|version)
conduit-cli/0.0.0 darwin-x64 node-v14.16.0
$ conduit --help [COMMAND]
USAGE
  $ conduit COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`conduit hello [FILE]`](#conduit-hello-file)
* [`conduit help [COMMAND]`](#conduit-help-command)

## `conduit hello [FILE]`

describe the command here

```
USAGE
  $ conduit hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ conduit hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/quintessential-sft/conduit/blob/v0.0.0/src/commands/hello.ts)_

## `conduit help [COMMAND]`

display help for conduit

```
USAGE
  $ conduit help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.3/src/commands/help.ts)_
<!-- commandsstop -->
