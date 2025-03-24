export interface IAmazonSNSSettings {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  platformApplications: Record<string, string>; // Maps platform types to their SNS ARNs
}
