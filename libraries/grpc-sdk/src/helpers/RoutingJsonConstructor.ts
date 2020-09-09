import {ConduitRoute} from "../interfaces";

export function constructRoute(route: ConduitRoute, middleware?: boolean) {
    let routeObject: any = {
        options: {},
        returns: {},
        grpcFunction: '',
        isMiddleware: !!middleware
    };
    routeObject.grpcFunction = route.handler;
    routeObject.options = route.input;
    routeObject.returns = {
        name: route.returnTypeName,
        fields: JSON.stringify(route.returnTypeFields)
    };
    for (let option in routeObject.options) {
        if (!routeObject.options.hasOwnProperty(option)) continue;
        routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }

    return routeObject;
}
