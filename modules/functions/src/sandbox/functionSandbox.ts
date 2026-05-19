import vm from 'node:vm';
import axios from 'axios';
import * as lodash from 'lodash-es';

/**
 * Trusted admin code execution for user-defined functions.
 *
 * Function bodies are authored via the admin API and run in the same Node.js
 * process as Conduit with full access to the injected `grpcSdk` — equivalent
 * to server-level privileges. This is intentional: the module is for
 * admin-trusted logic, not tenant-submitted or sandboxed "serverless" workloads.
 *
 * `node:vm` is used for a single execution timeout and a small `require`
 * allowlist (`lodash`, `axios`). Those are guardrails for accidental misuse, not
 * a security boundary. Do not rely on this layer to contain malicious code.
 *
 * The user handler and the `(grpcSdk, req, res) => …` invocation run in one
 * `runInContext` call so the timeout budget covers the whole run.
 */
export type CompiledUserFunction = {
  /** User function body (inside `function (grpcSdk, req, res) { ... }`). */
  userCode: string;
};

const ALLOWED_REQUIRE = new Map<string, unknown>([
  ['lodash', lodash],
  ['axios', axios],
]);

function createRequireShim() {
  return (id: string) => {
    const resolved = ALLOWED_REQUIRE.get(id);
    if (resolved === undefined) {
      throw new Error(`Cannot require '${id}': only 'lodash' and 'axios' are allowed`);
    }
    return resolved;
  };
}

/**
 * Validates syntax and returns a handle for repeated execution.
 */
export function compileUserFunctionScript(functionCode: string): CompiledUserFunction {
  new vm.Script(`module.exports = function(grpcSdk,req,res) { ${functionCode} }`, {
    filename: 'conduit-user-function.js',
  });
  return { userCode: functionCode };
}

export type RunUserSandboxOptions = {
  compiled: CompiledUserFunction;
  grpcSdk: unknown;
  request: unknown;
  timeoutMs: number;
  onConsoleLog: (line: string) => void;
  onUserCallback: (data: unknown) => void;
};

/**
 * Loads the user handler and invokes it in one VM run (single timeout budget).
 */
export function runUserFunctionInSandbox(options: RunUserSandboxOptions): void {
  const { compiled, grpcSdk, request, timeoutMs, onConsoleLog, onUserCallback } = options;

  const source = `
(function () {
  var module = { exports: {} };
  module.exports = function (grpcSdk, req, res) { ${compiled.userCode} };
  var userFn = module.exports;
  if (typeof userFn !== 'function') {
    throw new Error('User function must assign a function to module.exports');
  }
  userFn(grpcSdk, req, function (data) {
    __hostCb(data);
  });
})();
`;

  const mod = { exports: {} };
  const sandbox: vm.Context = {
    module: mod,
    exports: mod.exports,
    require: createRequireShim(),
    console: {
      log: (...args: unknown[]) => {
        onConsoleLog(args.map(a => String(a)).join(' '));
      },
    },
    grpcSdk,
    req: request,
    __hostCb: onUserCallback,
  };
  const context = vm.createContext(sandbox);
  const runScript = new vm.Script(source, { filename: 'conduit-user-function-run.js' });
  runScript.runInContext(context, { timeout: timeoutMs });
}
