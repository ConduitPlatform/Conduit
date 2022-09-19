export interface IRRunDependenciesInterface {
  command: string;
  options: {
    env: {
      [key: string]: any;
    };
  };
  delay: number;
}
