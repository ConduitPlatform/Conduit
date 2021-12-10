import { ConduitRoute } from '../../index';

export abstract class IConduitAdmin {
  abstract initialize(): void;
  abstract registerRoute(route: ConduitRoute): void;
}
