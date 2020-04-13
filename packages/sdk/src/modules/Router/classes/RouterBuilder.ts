import {ConduitRouteBuilder} from "./RouteBuilder";
import {ConduitRouteOptions} from "../../../interaces";

export abstract class ConduitRouterBuilder {

    constructor(routePath: string, middleware?: any[]) {

    }

    abstract get(path: string, options: ConduitRouteOptions, middleware: []): void

    abstract post(path: string, options: ConduitRouteOptions, middleware: []): void

    abstract put(path: string, options: ConduitRouteOptions, middleware: []): void

    abstract delete(path: string, options: ConduitRouteOptions, middleware: []): void

    abstract route(name: string): ConduitRouteBuilder

    abstract construct(): any
}
