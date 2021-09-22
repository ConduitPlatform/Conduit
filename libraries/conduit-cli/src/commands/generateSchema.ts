import { Command, flags } from '@oclif/command';
import { recoverCredentials } from '../utils/requestUtils';
import cli from 'cli-ux';
import { Requests } from '../http/http';
import { generateSchema } from '../generators/Schema/Schema.generator';

export default class GenerateSchema extends Command {
  static description = 'Generate Schema TS files for CMS schemas';

  static examples = [
    `$ conduit generate-schema
You have logged in!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  static args = [{ name: 'path' }];

  async run() {
    const { args, flags } = this.parse(GenerateSchema);
    cli.action.start('Recovering credentials');
    let requestClient: Requests;
    try {
      requestClient = await recoverCredentials(this);
      cli.action.stop('Done');
    } catch (e) {
      cli.action.stop('Failed to recover');
      return;
    }
    if (!args.path) {
      return this.log('Path not provided!');
    }
    let schemas: {
      results: any[];
      documentsCount: number;
    } = await requestClient.getCmsSchemasRequest(0, 5000);
    let supplementary = await requestClient.schemasFromOtherModules();
    schemas.results = schemas.results.concat(...supplementary.results);
    this.log('Found schemas: ', schemas.results.length);
    cli.action.start('Generating schemas');
    for (let i = 0; i < schemas.results.length; i++) {
      await generateSchema(schemas.results[i], args.path);
    }
    cli.action.stop();
  }
}
