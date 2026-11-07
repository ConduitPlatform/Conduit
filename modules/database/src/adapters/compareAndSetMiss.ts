/** Thrown inside a transaction so a missed predicate rolls every write in that transaction back. */
export class CompareAndSetMiss extends Error {
  constructor() {
    super('compareAndSet miss');
    this.name = 'CompareAndSetMiss';
  }
}
