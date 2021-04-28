export interface Trigger<T> {
  setup(options: T): PromiseLike<boolean>;
}
