export class ConfigController {
  private static instance: ConfigController;

  private constructor() {}

  private _config: any;

  get config() {
    // return copy of config and not the original object;
    return Object.assign({}, this._config);
  }

  set config(config: any) {
    this._config = config;
  }

  public static getInstance(): ConfigController {
    if (!ConfigController.instance) {
      ConfigController.instance = new ConfigController();
    }
    return ConfigController.instance;
  }
}
