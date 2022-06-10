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
   */
  createContainer(name: string): Promise<boolean | Error>;

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

  get(fileName: string, downloadPath?: string): Promise<any | Error>;

  getSignedUrl(fileName: string): Promise<any | Error>;

  getPublicUrl(fileName: string): Promise<any | Error>;

  rename(currentFilename: string, newFilename: string): Promise<boolean | Error>;

  moveToFolder(filename: string, newFolder: string): Promise<boolean | Error>;

  moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string,
  ): Promise<boolean | Error>;

  moveToContainer(filename: string, newContainer: string): Promise<boolean | Error>;

  moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string,
  ): Promise<boolean | Error>;
}
