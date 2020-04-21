export default {
  inMemoryStore: {
    active: {
      format: 'Boolean',
      default: false
    },
    providerName: {
      doc: 'The name for the storage provider to use',
      format: 'String',
      default: 'local'
    },
    settings: {
      redis: {
        host: {
          format: 'String',
          default: '127.0.0.1'
        },
        port: {
          format: 'Number',
          default: 6379
        },
        path: {
          doc: 'The UNIX socket string of the Redis server',
          format: 'String',
          default: undefined
        },
        url: {
          doc: 'The URL of the Redis server. Format: [redis[s]:]//[[user][:password@]][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]]',
          format: 'String',
          default: undefined
        },
        string_numbers: {
          doc: 'Set to true, Node Redis will return Redis number values as Strings instead of javascript Numbers. Useful if you need to handle big numbers (above Number.MAX_SAFE_INTEGER === 2^53). Hiredis is incapable of this behavior, so setting this option to true will result in the built-in javascript parser being used no matter the value of the parser option.',
          format: 'Boolean',
          default: undefined
        },
        return_buffers: {
          doc: 'If set to true, then all replies will be sent to callbacks as Buffers instead of Strings.',
          format: 'Boolean',
          default: false
        },
        detect_buffers: {
          doc: 'If set to true, then replies will be sent to callbacks as Buffers. This option lets you switch between Buffers and Strings on a per-command basis, whereas return_buffers applies to every command on a client. Note: This doesn\'t work properly with the pubsub mode. A subscriber has to either always return Strings or Buffers.',
          format: 'Boolean',
          default: false
        },
        socket_keepalive: {
          doc: 'If set to true, the keep-alive functionality is enabled on the underlying socket.',
          format: 'Boolean',
          default: true
        },
        socket_initial_delay: {
          doc: 'Initial Delay in milliseconds, and this will also behave the interval keep alive message sending to Redis.',
          format: 'Number',
          default: 0
        },
        no_ready_check: {
          doc: 'When a connection is established to the Redis server, the server might still be loading the database from disk. While loading, the server will not respond to any commands. To work around this, Node Redis has a "ready check" which sends the INFO command to the server. The response from the INFO command indicates whether the server is ready for more commands. When ready, node_redis emits a ready event. Setting no_ready_check to true will inhibit this check.',
          format: 'Boolean',
          default: false
        },
        enable_offline_queue: {
          doc: 'By default, if there is no active connection to the Redis server, commands are added to a queue and are executed once the connection has been established. Setting enable_offline_queue to false will disable this feature and the callback will be executed immediately with an error, or an error will be emitted if no callback is specified.',
          format: 'Boolean',
          default: true
        },
        retry_unfulfilled_commands: {
          doc: 'If set to true, all commands that were unfulfilled while the connection is lost will be retried after the connection has been reestablished. Use this with caution if you use state altering commands (e.g. incr). This is especially useful if you use blocking commands.',
          format: 'Boolean',
          default: false
        },
        password: {
          format: 'String',
          default: undefined
        },
        db: {
          format: 'String',
          default: undefined
        },
        family: {
          doc: 'You can force using IPv6 if you set the family to \'IPv6\'. See Node.js net or dns modules on how to use the family type.',
          format: 'String',
          default: 'IPv4'
        },
        disable_resubscribing: {
          doc: 'If set to true, a client won\'t resubscribe after disconnecting.',
          format: 'Boolean',
          default: false
        },
        rename_commands: {
          doc: 'Passing an object with renamed commands to use instead of the original functions. For example, if you renamed the command KEYS to "DO-NOT-USE" then the rename_commands object would be: { KEYS : "DO-NOT-USE" } . See the Redis security topics for more info.',
          format: '*',
          default: undefined
        },
        tls: {
          doc: 'An object containing options to pass to tls.connect to set up a TLS connection to Redis (if, for example, it is set up to be accessible via a tunnel).',
          format: '*',
          default: undefined
        },
        prefix: {
          doc: 'A string used to prefix all used keys (e.g. namespace:test). Please be aware that the keys command will not be prefixed. The keys command has a "pattern" as argument and no key and it would be impossible to determine the existing keys in Redis if this would be prefixed.',
          format: 'String',
          default: undefined
        },
        retry_strategy: {
          format: '*',
          default: undefined
        }
      },
      memcache: {
        server: {
          format: 'String',
          default: undefined
        },
        options: {
          format: '*',
          default: undefined
        },

      },
      local: {
        format: 'Object',
        default: undefined
      }
    }
  }
};
