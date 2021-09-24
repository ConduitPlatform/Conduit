import { Command, flags } from '@oclif/command';
import cli from 'cli-ux';
import { Requests } from '../http/http';
import { recoverUrl, storeCredentials } from '../utils/requestUtils';

export default class Init extends Command {
  static description = 'Initialize the CLI to communicate with Conduit';

  static examples = [
    `$ conduit init
You have logged in!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    relogin: flags.string({ char: 'r', description: 'Reuses url and master key' }),
  };

  async run() {
    const { args, flags } = this.parse(Init);
    let url, masterKey;
    if (flags.relogin) {
      let obj = await recoverUrl(this);
      url = obj.url;
      masterKey = obj.masterKey;
    } else {
      url = await cli.prompt('Add the API url of your conduit installation');
      masterKey = await cli.prompt('Add the master key of your conduit installation');
    }
    const adminUsername = await cli.prompt('Add the admin username');
    const adminPassword = await cli.prompt('Add the admin password');
    let requestInstance = new Requests(url, masterKey);
    cli.action.start('Attempting login');
    try {
      let usr = await requestInstance.loginRequest(adminUsername, adminPassword);
      await storeCredentials(this, { url, masterKey }, usr!);
      cli.action.stop('Login Successful!');
    } catch (e) {
      this.log(e);
      cli.action.stop('Login failed!');
    }
  }
}
