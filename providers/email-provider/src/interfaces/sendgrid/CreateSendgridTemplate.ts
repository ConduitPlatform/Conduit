import { SengridTemplateVersion } from "./SendgridTemplateVersion";

export interface CreateSendgridTemplate{
    name:string;
    generation:string;
    version:SengridTemplateVersion;
}