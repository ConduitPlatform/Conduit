export interface IRunDependenciesInterface {
  command: string;
  ExecOptions: {
    env: {
      [key: string]: any;
    };
  };
  delay: number;
}
