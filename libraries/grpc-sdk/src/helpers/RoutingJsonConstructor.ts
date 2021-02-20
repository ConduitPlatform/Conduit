import {ConduitMiddleware, ConduitRoute} from "../classes";

export function constructRoute(route: ConduitRoute) {
    let routeObject: any = {
        options: {},
        returns: {},
        grpcFunction: ''
    };
    routeObject.grpcFunction = route.handler;
    routeObject.options = route.input;
    routeObject.returns = {
        name: route.returnTypeName,
        fields: JSON.stringify(route.returnTypeFields)
    };
    for (let option in routeObject.options) {
        if (!routeObject.options.hasOwnProperty(option)) continue;
        if(option === 'middlewares') continue;
        routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }

    return routeObject;
}
export function constructMiddleware(route: ConduitMiddleware) {
    let routeObject: any = {
        options: {},
        grpcFunction: ''
    };
    routeObject.grpcFunction = route.handler;
    routeObject.options = route.input.path ? route.input : null;
    for (let option in routeObject.options) {
        if (!routeObject.options.hasOwnProperty(option)) continue;
        routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }

    return routeObject;
}
