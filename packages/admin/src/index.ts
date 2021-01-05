import { isNil } from "lodash";
import { hashPassword, verifyToken } from "./utils/auth";
import { Router, Handler, Request, Response, NextFunction } from "express";
import { AuthHandlers } from "./handlers/auth";
import { AdminSchema } from "./models/Admin";
import { ConduitError, ConduitRouteParameters, ConduitSDK, IConduitAdmin } from "@quintessential-sft/conduit-sdk";
import AdminConfigSchema from "./config";
import * as grpc from "grpc";

let protoLoader = require("@grpc/proto-loader");
import fs from "fs";
import path from "path";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";

export default class AdminModule extends IConduitAdmin {
  private readonly router: Router;
  conduit: ConduitSDK;
  grpcSdk: ConduitGrpcSdk;

  constructor(grpcSdk: ConduitGrpcSdk, conduit: ConduitSDK, server: grpc.Server, packageDefinition: any) {
    super(conduit);
    this.conduit = conduit;
    this.grpcSdk = grpcSdk;
    this.router = Router();

    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

    //grpc stuff
    // @ts-ignore
    let admin = protoDescriptor.conduit.core.Admin;
    server.addService(admin.service, {
      registerAdminRoute: this.registerAdminRoute.bind(this),
    });
  }

  async initialize() {
    await this.conduit.getConfigManager().registerModulesConfig("admin", AdminConfigSchema.getProperties());
    await this.handleDatabase().catch(console.log);
    const adminHandlers = new AuthHandlers(this.grpcSdk, this.conduit);
    this.conduit
      .getRouter()
      .registerDirectRouter("/admin/login", (req: Request, res: Response, next: NextFunction) =>
        adminHandlers.loginAdmin(req, res, next).catch(next)
      );
    this.conduit.getRouter().registerDirectRouter("/admin/login", (req: Request, res: Response, next: NextFunction) => {
      let response: any[] = [];
      // this is used here as such, because the config manager is simply the config package
      // todo update the config manager interface so that we don't need these castings
      ((this.conduit.getConfigManager() as any).registeredModules as Map<string, string>).forEach(
        (val: any, key: any) => {
          response.push(val);
        }
      );
      res.json(response);
    });

    // todo fix the middlewares
    //@ts-ignore
    this.conduit.getRouter().registerRouteMiddleware("/admin", this.adminMiddleware);
    this.router.use((req, res, next) => this.authMiddleware(req, res, next));
    this.conduit.getRouter().registerExpressRouter("/admin", this.router);
    this.highAvailability();
  }

  highAvailability() {
    const self = this;
    this.conduit
      .getState()
      .getKey("admin")
      .then((r) => {
        if (!r || r.length === 0) return;
        let state = JSON.parse(r);
        if (state.routes) {
          state.routes.forEach((r: any) => {
            self
              ._registerGprcRoute(r.protofile, r.routes, r.url)
              .then()
              .catch((err) => {
                console.log("Failed to register recovered route");
              });
          });
        }
      })
      .catch((err) => {
        console.log("Failed to recover state");
      });

    this.conduit.getBus().subscribe("admin", (message: string) => {
      let messageParsed = JSON.parse(message);
      self._registerGprcRoute(messageParsed.protofile, messageParsed.routes, messageParsed.url);
    });
  }

  updateState(protofile: string, routes: any, url: string) {
    this.conduit
      .getState()
      .getKey("admin")
      .then((r) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.routes) state.routes = [];
        state.routes.push({
          protofile,
          routes,
          url,
        });
        return this.conduit.getState().setKey("admin", JSON.stringify(state));
      })
      .then((r) => {
        console.log("Updated state");
      })
      .catch((err) => {
        console.log("Failed to recover state");
      });
  }

  publishAdminRouteData(protofile: string, routes: any, url: string) {
    this.conduit.getBus().publish(
      "admin",
      JSON.stringify({
        protofile,
        routes,
        url,
      })
    );
  }

  // @ts-ignore
  private async handleDatabase() {
    if (!this.grpcSdk.databaseProvider) {
      await this.grpcSdk.waitForExistence("database-provider");
    }
    const databaseAdapter = this.grpcSdk.databaseProvider!;

    await databaseAdapter.createSchemaFromAdapter(AdminSchema);

    databaseAdapter
      .findOne("Admin", { username: "admin" })
      .then(async (existing: any) => {
        if (isNil(existing)) {
          const adminConfig = await this.conduit.getConfigManager().get("admin");
          const hashRounds = adminConfig.auth.hashRounds;
          return hashPassword("admin", hashRounds);
        }
        return Promise.resolve(null);
      })
      .then((result: string | null) => {
        if (!isNil(result)) {
          return databaseAdapter.create("Admin", { username: "admin", password: result });
        }
      })
      .catch(console.log);
  }

  findAdmin(object: any) {
    let value;
    const self = this;
    Object.keys(object).some(function (k) {
      if (k === "Admin") {
        value = object[k];
        return true;
      }
      if (object[k] && typeof object[k] === "object") {
        value = self.findAdmin(object[k]);
        return value !== undefined;
      }
    });
    return value;
  }

  //grpc
  async registerAdminRoute(call: any, callback: any) {
    let protofile = call.request.protoFile;
    let routes: [{ path: string; method: string; grpcFunction: string }] = call.request.routes;
    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protofile);
    var packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let adminDescriptor: any = grpc.loadPackageDefinition(packageDefinition);
    adminDescriptor = this.findAdmin(adminDescriptor);
    if (!adminDescriptor) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Did not receive proper .proto file - missing Admin service",
      });
    }
    let error;
    let done = await this._registerGprcRoute(protofile, routes, call.request.adminUrl).catch((err) => (error = err));
    if (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: "Error when registering routs",
      });
    } else {
      this.publishAdminRouteData(protofile, routes, call.request.adminUrl);
      this.updateState(protofile, routes, call.request.adminUrl);
      //perhaps wrong(?) we send an empty response
      callback(null, null);
    }
  }

  private async _registerGprcRoute(adminProtofile: any, routes: any, serverIp: string) {
    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, adminProtofile);
    var packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let adminDescriptor: any = grpc.loadPackageDefinition(packageDefinition);
    adminDescriptor = this.findAdmin(adminDescriptor);

    let client = new adminDescriptor(serverIp, grpc.credentials.createInsecure());
    routes.forEach((r: any) => {
      let handler = (req: any, res: any, next: any) => {
        const context = (req as any).conduit;
        let params: any = {};
        if (req.query) {
          Object.assign(params, req.query);
        }
        if (req.body) {
          Object.assign(params, req.body);
        }
        if (req.params) {
          Object.assign(params, req.params);
        }
        if (params.populate) {
          if (params.populate.includes(",")) {
            params.populate = params.populate.split(",");
          } else {
            params.populate = [params.populate];
          }
        }
        let request = {
          params: JSON.stringify(params),
          header: JSON.stringify(req.headers),
          context: JSON.stringify(context),
        };
        client[r.grpcFunction](request, (err: any, result: any) => {
          if (err) {
            return res.status(500).send(err);
          }
          let sendResult = result.result;
          try {
            sendResult = JSON.parse(result.result);
          } catch (error) {
            // do nothing
          }
          res.status(200).json(sendResult);
        });
      };
      this.registerRoute(r.method, r.path, handler);
    });
  }

  registerRoute(method: string, route: string, handler: Handler) {
    switch (method) {
      case "GET":
        this.router.get(route, handler);
        break;
      case "POST":
        this.router.post(route, handler);
        break;
      case "PUT":
        this.router.put(route, handler);
        break;
      case "DELETE":
        this.router.delete(route, handler);
        break;
      default:
        this.router.get(route, handler);
    }
  }

  async authMiddleware(req: Request, res: Response, next: NextFunction) {
    const databaseAdapter = await this.grpcSdk.databaseProvider!;
    const adminConfig = await this.conduit.getConfigManager().get("admin");

    const tokenHeader = req.headers.authorization;
    if (isNil(tokenHeader)) {
      return res.status(401).json({ error: "No token provided" });
    }

    const args = tokenHeader.split(" ");
    if (args.length !== 2) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const [prefix, token] = args;
    if (prefix !== "JWT") {
      return res.status(401).json({ error: "The authorization header must begin with JWT" });
    }
    let decoded;
    try {
      decoded = verifyToken(token, adminConfig.auth.tokenSecret);
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const { id } = decoded;

    databaseAdapter
      .findOne("Admin", { _id: id })
      .then((admin: any) => {
        if (isNil(admin)) {
          return res.status(401).json({ error: "No such user exists" });
        }
        (req as any).admin = admin;
        next();
      })
      .catch((error: Error) => {
        console.log(error);
        res.status(500).json({ error: "Something went wrong" });
      });
  }

  async adminMiddleware(context: ConduitRouteParameters) {
    const adminConfig = await this.conduit.getConfigManager().get("admin");
    return new Promise((resolve, reject) => {
      const masterkey = context.headers.masterkey;
      if (isNil(masterkey) || masterkey !== adminConfig.auth.masterkey)
        throw new ConduitError("UNAUTHORIZED", 401, "Unauthorized");
      resolve("ok");
    });
  }
}
