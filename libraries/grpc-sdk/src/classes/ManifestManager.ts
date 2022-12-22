import { Schema, Validator, ValidationError } from 'jsonschema';
import ConduitGrpcSdk from '../index';
import {
  DeploymentState_ModuleStateInfo as ModuleStateInfo,
  RegisterModuleRequest_ConduitManifest as ConduitManifest,
  RegisterModuleRequest_ConduitManifest_Dependency as ConduitManifestDependency,
} from '../protoUtils/core';

const jsonManifestSchema: Schema = {
  title: 'ConduitManifest',
  type: 'object',
  required: true,
  properties: {
    version: {
      type: 'String',
      required: true,
    },
    dependencies: {
      type: 'object',
      required: false, // required for everyone, except Core
      properties: {
        conduit: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              required: true,
            },
          },
        },
      },
      additionalProperties: {
        // dependency (module)
        type: 'object',
        properties: {
          version: {
            type: 'string',
            required: true,
          },
        },
      },
    },
  },
};

type JsonManifest = {
  version: string;
  dependencies: {
    // empty for Core
    [dep: string]: {
      version: string;
    };
  };
};

enum TagComparisonOperator {
  Equal = 0,
  GreaterEqual = 1,
}

export class ManifestError extends Error {
  constructor(errors: ValidationError[], jsonPath: string) {
    let errorString = `${errors.length} Conduit manifest ${
      errors.length > 1 ? 'errors' : 'error'
    } detected in ${jsonPath}.\n`;
    errors.forEach(e => (errorString = `${errorString.concat(e.stack)}.\n`));
    super(errorString);
  }
}

export class ManifestManager {
  private static _instance: ManifestManager;
  readonly manifest: ConduitManifest;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly moduleName: string,
    packageJsonPath: string,
  ) {
    jsonManifestSchema.properties!.dependencies.required = grpcSdk.isModule;
    this.manifest = this.parsePackageJson(packageJsonPath, jsonManifestSchema);
  }

  get moduleVersion() {
    return this.manifest.moduleVersion;
  }

  static getInstance(
    grpcSdk?: ConduitGrpcSdk,
    moduleName?: string,
    packageJsonPath?: string,
  ) {
    if (ManifestManager._instance) return ManifestManager._instance;
    if (grpcSdk === undefined) {
      throw new Error('ConduitGrpcSdk not provided!');
    }
    if (!moduleName) {
      throw new Error('moduleName not provided!');
    }
    if (!packageJsonPath) {
      throw new Error('packageJsonPath not provided!');
    }
    ManifestManager._instance = new ManifestManager(grpcSdk, moduleName, packageJsonPath);
    return ManifestManager._instance;
  }

  private parsePackageJson(jsonPath: string, validationSchema: Schema): ConduitManifest {
    const packageJson = require(jsonPath);
    if (!packageJson.conduit) {
      throw new Error("Missing 'conduit' section in package.json");
    }
    // Validate Json Input
    const v = new Validator();
    const jsonManifest: JsonManifest = {
      version: packageJson.version,
      dependencies: packageJson.conduit.dependencies ?? {},
    };
    const res = v.validate(jsonManifest, validationSchema);
    if (res.errors.length > 0) {
      throw new ManifestError(res.errors, jsonPath);
    }
    // Convert to Protobuff-friendly format
    const manifest: ConduitManifest = {
      moduleName: this.moduleName,
      moduleVersion: jsonManifest.version,
      dependencies: [],
    };
    (
      Object.entries(jsonManifest.dependencies) as [string, ConduitManifestDependency][]
    ).forEach(([depName, depObj]) => {
      manifest.dependencies.push({
        name: depName,
        version: depObj.version,
      });
    });
    return manifest;
  }

  readyCheck(
    deploymentState: Map<string, ModuleStateInfo>,
    moduleManifest: ConduitManifest,
  ): { issues: string[] } {
    const issues: string[] = [];
    moduleManifest.dependencies.forEach(dep => {
      const depState = [...deploymentState.values()].find(
        m => m.moduleName === dep.name && !m.pending,
      );
      if (!depState) {
        issues.push(
          `Requested dependency on '${dep.name}' could not be fulfilled. Module not available.`,
        );
        return;
      }
      try {
        this.validateTag(dep.name, dep.version, depState.moduleVersion);
      } catch (err) {
        issues.push((err as Error).message);
      }
    });
    return { issues };
  }

  private parseTag(tag: string): {
    tag: string;
    preVersionOne: boolean;
    majorVersion: number;
    minorVersion: number;
    operator: TagComparisonOperator;
  } {
    // ex input: '0.16', '0.16.0', '^1.12'...
    const originalTag = tag;
    let operator = TagComparisonOperator.Equal;
    if (isNaN(parseInt(tag[0]))) {
      operator =
        tag[0] === '^' ? TagComparisonOperator.GreaterEqual : TagComparisonOperator.Equal;
      tag = tag.slice(1);
    }
    const rcIndex = tag.indexOf('-');
    if (rcIndex !== -1) {
      tag = tag.slice(0, rcIndex);
    }
    const preVersionOne = parseInt(tag[0]) === 0;
    const splitTag = tag.split('.');
    const majorVersion = parseInt(
      (preVersionOne ? splitTag.slice(1, 2) : splitTag.slice(0, 1))[0],
    );
    let minorVersion = parseInt(
      (preVersionOne ? splitTag.slice(2, 3) : splitTag.slice(1, 2))[0],
    );
    if (isNaN(majorVersion)) {
      throw new Error(`Invalid version tag '${originalTag}' format.`);
    }
    if (isNaN(minorVersion)) {
      minorVersion = 0;
    }
    return {
      tag,
      preVersionOne,
      majorVersion,
      minorVersion,
      operator,
    };
  }

  validateTag(depName: string, requestedTag: string, availableTag: string) {
    // Minor versions don't break compatibility (v0.16.1 is a valid target for ^v0.16)
    // RC information is stripped (v0.16.0-rc1 is a valid target for v0.16)
    const requested = this.parseTag(requestedTag);
    const available = this.parseTag(availableTag);
    if (
      requested.preVersionOne === available.preVersionOne &&
      requested.operator === TagComparisonOperator.Equal &&
      requested.tag === available.tag
    )
      return;
    else if (
      requested.preVersionOne === available.preVersionOne &&
      requested.operator === TagComparisonOperator.GreaterEqual &&
      requested.majorVersion === available.majorVersion &&
      requested.minorVersion <= available.minorVersion
    )
      return;
    throw new Error(
      `Requested dependency on '${depName}@${requestedTag}' could not be fulfilled. ` +
        `Target version mismatch (found: ${availableTag}).`,
    );
  }
}
