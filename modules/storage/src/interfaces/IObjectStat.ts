export type ObjectStat = {
  exists: boolean;
  size?: number;
  etag?: string;
  contentType?: string;
  lastModified?: Date;
  checksum?: string;
};
