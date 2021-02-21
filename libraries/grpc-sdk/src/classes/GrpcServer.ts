import * as grpc from "grpc";
import {addServiceToServer, createServer} from "../helpers";

export class GrpcServer{

    private readonly _url: string;
    private grpcServer: grpc.Server;
    private started: boolean = false;
    private startedOnce: boolean = false;
    private _serviceNames: string[] = [];
    private scheduledRestart: any;
    private _services: {
        protoFilePath: string,
        protoDescription: string,
        functions:{ [name: string]: Function }
    }[] = [];

    constructor(originalUrl?: string) {

        this._url = originalUrl || "0.0.0.0:0";
        let serverResult = createServer(this._url);
        this.grpcServer = serverResult.server;
        this._url = originalUrl || "0.0.0.0:" + serverResult.port;
        console.log("bound on:", this._url);
    }

    createNewServer():number{
        let serverResult = createServer(this._url);
        this.grpcServer = serverResult.server;
        return serverResult.port;
    }

    async addService(protoFilePath: string,protoDescription:string, functions: { [name: string]: Function }): Promise<GrpcServer>{
        if(this._serviceNames.indexOf(protoDescription)!==-1) {
            console.log("Service already exists, performing replace")
            this._services[this._serviceNames.indexOf(protoDescription)] = {protoFilePath, protoDescription, functions};
            this.scheduleRefresh();
            return this;
        }else{
            this._services.push({protoFilePath, protoDescription, functions})
            this._serviceNames.push(protoDescription);
            if(this.started){
                console.log("Server already started, scheduling refresh..")
                this.scheduleRefresh();
                return this;
            }else{
                addServiceToServer(this.grpcServer, protoFilePath, protoDescription, functions);
                return this;
            }
        }
    }
    async refresh(): Promise<void>{
        if(this.started){
            this.started = false;
            //gracefully shutdown so that there are no service disruption
            await new Promise((resolve)=>this.grpcServer.tryShutdown(()=>resolve()));

        }
        this.createNewServer();
        this._services.forEach(service=>{
            addServiceToServer(this.grpcServer, service.protoFilePath, service.protoDescription, service.functions);
        })
        if(!this.started && this.startedOnce){
            this.grpcServer.start();
            this.started = true;
        }
    }

    scheduleRefresh(){
        if(this.scheduledRestart){
            clearTimeout(this.scheduledRestart);
        }
        const self = this;
        this.scheduledRestart = setTimeout(async ()=>{
            console.log("Begin refresh")
            await self.refresh();
            console.log("Refresh complete");
        },2000)
    }

    get url(): string{
        return this._url;
    }

    start(): void{
        this.started = true;
        this.startedOnce = true;
        this.grpcServer.start();
    }






}
