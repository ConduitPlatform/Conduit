import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { ConduitSDK, IConduitSecurity, PlatformTypesEnum, ConduitError } from "@quintessential-sft/conduit-sdk";
import { NextFunction, Request, Response } from "express";
import { isNil } from "lodash";

export class Admin {
  constructor(private readonly conduit: ConduitSDK, private readonly grpcSdk: ConduitGrpcSdk) {
    this.createClientRoutes();
  }

  createClientRoutes() {
    this.conduit.getAdmin().registerRoute("POST", "/security/client", this.createClient.bind(this));
    this.conduit.getAdmin().registerRoute("PUT", "/security/client/:id", this.editClient.bind(this));
    this.conduit.getAdmin().registerRoute("GET", "/security/client", this.getClients.bind(this));
  }

  async createClient(req: Request, res: Response, next: NextFunction) {
    const { clientId, clientSecret, platform } = req.body;

    if (!Object.values(PlatformTypesEnum).includes(platform)) {
      return res.status(401).json({ error: "Invalid platform" });
    }
    let error;
    await this.grpcSdk.databaseProvider
      ?.create("Client", {
        clientId,
        clientSecret,
        platform,
      })
      .catch((err) => (error = err));
    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong!" });
    }

    return res.json({ message: "Client created" });
  }

  async editClient(req: Request, res: Response, next: NextFunction) {
    if (!req.params.id) res.status(400).json({ message: "Client parameter missing" });
    this.grpcSdk.databaseProvider
      ?.findByIdAndUpdate("Client", req.params.id, req.body)
      .then((client: any) => {
        return res.json({ message: "Client updatd" });
      })
      .catch((e) => {
        return res.status(500).json({ message: "Client update failed!" });
      });
  }

  async getClients(req: Request, res: Response, next: NextFunction) {
    this.grpcSdk.databaseProvider
      ?.findMany("Client", {})
      .then((clients: any) => {
        res.json(clients);
      })
      .catch((e) => {
        return res.status(500).json({ message: "Client fetch failed!" });
      });
  }
}
