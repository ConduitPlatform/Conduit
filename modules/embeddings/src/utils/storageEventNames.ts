export const FILE_LIFECYCLE_EVENTS = {
  ready: 'storage:ready:File',
  update: 'storage:update:File',
  delete: 'storage:delete:File',
  deleteMany: 'storage:deleteMany:File',
  deleteFolder: 'storage:delete:Folder',
  deleteContainer: 'storage:delete:Container',
} as const;
