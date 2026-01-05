export type UrlOptions = {
  download?: boolean;
  fileName?: string;
};

export interface IStorageProvider {
  store(fileName: string, data: any, isPublic?: boolean): Promise<boolean | Error>;

  /**
   * Used to create a new folder
   * @param name For the folder
   */
  createFolder(name: string): Promise<boolean | Error>;

  folderExists(name: string): Promise<boolean | Error>;

  /**
   * Used to create a new container
   * @param name For the container
   * @param isPublic Whether the container should be publicly accessible
   */
  createContainer(name: string, isPublic?: boolean): Promise<boolean | Error>;

  /**
   * Used to set the public access level of an existing container
   * @param name For the container
   * @param isPublic Whether the container should be publicly accessible
   */
  setContainerPublicAccess(name: string, isPublic: boolean): Promise<boolean | Error>;

  /**
   * Used to switch the current container.
   * Ex. storage.container('photos').file('test')
   * @param name For the container
   */
  container(name: string): IStorageProvider;

  containerExists(name: string): Promise<boolean | Error>;

  deleteContainer(name: string): Promise<boolean | Error>;

  deleteFolder(name: string): Promise<boolean | Error>;

  delete(fileName: string): Promise<boolean | Error>;

  exists(fileName: string): Promise<boolean | Error>;

  get(fileName: string, downloadPath?: string): Promise<Buffer | Error>;

  getSignedUrl(fileName: string, options?: UrlOptions): Promise<any | Error>;

  /**
   * Gets a publicly accessible URL for a file.
   * @param fileName The file name/path
   * @param containerIsPublic Whether the container is publicly accessible.
   *        If true, returns a plain URL. If false, returns a long-lived signed URL.
   */
  getPublicUrl(fileName: string, containerIsPublic?: boolean): Promise<string | Error>;

  getUploadUrl(fileName: string): Promise<string | Error>;
}
