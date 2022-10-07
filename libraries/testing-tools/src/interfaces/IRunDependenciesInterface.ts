export interface IRunDependenciesInterface {
  command: string;
  options: {
    env: {
      [key: string]: any;
    };
  };
  delay: number;
}
