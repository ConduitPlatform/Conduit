import {Router} from "express";
import {ConduitRouteOptions} from "../../../interfaces";

export abstract class ConduitRouteBuilder {

    constructor(routePath: string) {
    }

    abstract get(options: ConduitRouteOptions, middleware: []): ConduitRouteBuilder

    abstract post(options: ConduitRouteOptions, middleware: []): ConduitRouteBuilder

    abstract put(options: ConduitRouteOptions, middleware: []): ConduitRouteBuilder

    abstract delete(options: ConduitRouteOptions, middleware: []): ConduitRouteBuilder

    abstract construct(router: Router): void

}
