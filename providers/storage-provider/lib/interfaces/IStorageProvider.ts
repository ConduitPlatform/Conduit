export interface IStorageProvider {
  store(fileName: string, data: any, isPublic?: boolean): Promise<boolean | Error>;

  get(fileName: string, downloadPath?: string): Promise<any | Error>;

  /**
   * Used to create a new folder
   * @param name For the folder
   */
  createFolder(name: string): Promise<boolean | Error>;

  /**
   * Used to switch the current folder.
   * Ex. storage.folder('photos').file('test')
   * @param name For the folder
   */
  folder(name: string): IStorageProvider;

  folderExists(name: string): Promise<boolean | Error>;

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
    newFolder: string
  ): Promise<boolean | Error>;
}
