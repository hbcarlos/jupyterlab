import { Contents, ServerConnection } from '@jupyterlab/services';

import { PathExt } from '@jupyterlab/coreutils';

import { JSONExt } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import { WebrtcProvider } from 'y-webrtc';

import { Awareness } from 'y-protocols/awareness';

import * as Y from 'yjs';

export const DRIVE_NAME = 'FileSystem';

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}

export class FileSystemDrive implements Contents.IDrive {
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._ydoc.destroy();
    this._provider.destroy();
    this._isDisposed = true;
    Signal.clearData(this);
  }

  get name(): string {
    return DRIVE_NAME;
  }

  get serverSettings(): ServerConnection.ISettings {
    return ServerConnection.makeSettings();
  }

  get fileChanged(): ISignal<Contents.IDrive, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  get rootHandle(): FileSystemDirectoryHandle | null {
    return this._rootHandle;
  }

  set rootHandle(handle: FileSystemDirectoryHandle | null) {
    this._rootHandle = handle;

    if (handle) {
      this._provider = new WebrtcProvider(
        'random-room-id-for-testing-jupyterlab',
        this._ydoc,
        {
          signaling: [
            'wss://signaling.yjs.dev',
            'wss://y-webrtc-signaling-eu.herokuapp.com'
          ], //, 'wss://y-webrtc-signaling-us.herokuapp.com'],
          password: null,
          awareness: new Awareness(this._ydoc),
          maxConns: 20 + Math.floor(Math.random() * 15), // the random factor reduces the chance that n clients form a cluster
          filterBcConns: true,
          peerOpts: {} // simple-peer options. See https://github.com/feross/simple-peer#peer--new-peeropts
        }
      );
    }
  }

  /**
   * Open a file.
   *
   * @param path: The path to the file.
   *
   * @param options: The options used to open the file.
   *
   * @returns A promise which resolves with the file content.
   */
  open(path: string, options: Contents.IOpenOptions): Promise<void> {
    // NO-OP
    return Promise.resolve();
  }

  /**
   * Close a file.
   *
   * @param path: The path to the file.
   *
   * @returns A promise which resolves with the file content.
   */
  close(path: string): Promise<void> {
    // NO-OP
    return Promise.resolve();
  }

  async get(
    path: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    if (!this._rootHandle) {
      return Private.createEmptyDirModel();
    }

    const [handle, yItem] = await this.getItem(path);

    const parentPath = PathExt.dirname(path);
    const localPath = PathExt.basename(path);

    if (handle.kind === 'file') {
      const model = await this.getFileModel(handle, parentPath, true);
      Private.updateYFile(yItem as Y.Doc, model);
      return model;
    } else {
      const content: Contents.IModel[] = [];

      for await (const value of handle.values()) {
        if (value.kind === 'file') {
          const model = await this.getFileModel(
            value,
            PathExt.join(parentPath, localPath)
          );

          let yfile = yItem.get(value.name);
          if (!yfile) {
            yfile = new Y.Doc({ autoLoad: true });
            (yItem as Y.Map<any>).set(value.name, yfile);
          }
          Private.updateYFile(yfile as Y.Doc, model);

          content.push(model);
        } else {
          const model = {
            ...Private.createEmptyDirModel(),
            name: value.name,
            path: PathExt.join(parentPath, localPath, value.name)
          };

          let yfolder = yItem.get(value.name);
          if (!yfolder) {
            yfolder = new Y.Map();
            (yItem as Y.Map<any>).set(value.name, yfolder);
          }
          Private.updateYFolder(yfolder, model);

          content.push(model);
        }
      }

      const model = {
        ...Private.createEmptyDirModel(),
        name: localPath,
        path: PathExt.join(parentPath, localPath),
        content
      };
      Private.updateYFolder(yItem as Y.Map<any>, model);
      return model;
    }
  }

  getDownloadUrl(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async newUntitled(
    options?: Contents.ICreateOptions
  ): Promise<Contents.IModel> {
    return Promise.resolve({
      name: '',
      path: '',
      last_modified: '',
      created: '',
      format: null,
      mimetype: '',
      content: '',
      size: undefined,
      writable: false,
      type: 'file'
    });
  }

  async delete(path: string): Promise<void> {
    return Promise.resolve();
  }

  async rename(oldPath: string, newPath: string): Promise<Contents.IModel> {
    return Promise.resolve({
      name: '',
      path: '',
      last_modified: '',
      created: '',
      format: null,
      mimetype: '',
      content: '',
      size: undefined,
      writable: false,
      type: 'file'
    });
  }

  async save(
    path: string,
    options?: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    return Promise.resolve({
      name: '',
      path: '',
      last_modified: '',
      created: '',
      format: null,
      mimetype: '',
      content: '',
      size: undefined,
      writable: false,
      type: 'file'
    });
  }

  async copy(path: string, toLocalDir: string): Promise<Contents.IModel> {
    return Promise.resolve({
      name: '',
      path: '',
      last_modified: '',
      created: '',
      format: null,
      mimetype: '',
      content: '',
      size: undefined,
      writable: false,
      type: 'file'
    });
  }

  async createCheckpoint(path: string): Promise<Contents.ICheckpointModel> {
    return {
      id: 'test',
      last_modified: new Date().toISOString()
    };
  }

  async listCheckpoints(path: string): Promise<Contents.ICheckpointModel[]> {
    return [
      {
        id: 'test',
        last_modified: new Date().toISOString()
      }
    ];
  }

  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.resolve(void 0);
  }

  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.resolve(void 0);
  }

  private async getItem(
    path: string
  ): Promise<[FileSystemHandle, Y.Map<any> | Y.Doc]> {
    if (!this._rootHandle) throw new Error('No root file handle');

    if (path.length == 0) {
      return [this._rootHandle, this._root];
    }

    let yItem = this._root as any;
    let handle: any = this._rootHandle;
    for (const subPath of path.split('/')) {
      yItem = yItem.get(subPath);

      if (PathExt.extname(subPath).length == 0) {
        handle = await handle.getDirectoryHandle(subPath);
      } else {
        handle = await handle.getFileHandle(subPath);
      }
    }

    return [handle, yItem];
  }

  private async getFileModel(
    handle: FileSystemFileHandle,
    path: string,
    content?: boolean
  ): Promise<Contents.IModel> {
    const file = await handle.getFile();
    let format: Contents.FileFormat;
    let fileContent: any = null;

    // We assume here image, audio and video mimetypes are all and only binary files we'll encounter
    if (
      file.type &&
      file.type.split('/') &&
      ['image', 'audio', 'video'].includes(file.type.split('/')[0])
    ) {
      format = 'base64';
    } else {
      format = 'text';
    }

    if (content) {
      if (format === 'base64') {
        fileContent = arrayBufferToBase64(await file.arrayBuffer());
      } else {
        fileContent = await file.text();
      }
    }

    return {
      name: file.name,
      path: PathExt.join(path, file.name),
      created: new Date(file.lastModified).toISOString(),
      last_modified: new Date(file.lastModified).toISOString(),
      format,
      content: fileContent,
      writable: true,
      type: 'file',
      mimetype: file.type
    };
  }

  private _isDisposed = false;
  private _fileChanged = new Signal<Contents.IDrive, Contents.IChangedArgs>(
    this
  );
  private _rootHandle: FileSystemDirectoryHandle | null = null;
  private _ydoc: Y.Doc = new Y.Doc();
  private _root: Y.Map<Y.Doc | Y.Map<any>> = this._ydoc.getMap('root');
  private _provider: WebrtcProvider;
}

namespace Private {
  export function updateYFile(yfile: Y.Doc, model: Contents.IModel): void {
    const state = yfile.getMap('state');
    if (state && !JSONExt.deepEqual(state.toJSON(), model as any)) {
      Object.entries(model).map(entry =>
        state.set(entry[0], JSONExt.deepCopy(entry[1]))
      );
    } else if (!state) {
      const state = yfile.getMap('state');
      Object.entries(model).map(entry =>
        state.set(entry[0], JSONExt.deepCopy(entry[1]))
      );
    }
  }

  export function updateYFolder(
    yfolder: Y.Map<any>,
    model: Contents.IModel
  ): void {
    const state = yfolder.get('randomnameforthecontext');
    if (state && !JSONExt.deepEqual(state.toJSON(), model as any)) {
      Object.entries(model).map(entry =>
        state.set(entry[0], JSONExt.deepCopy(entry[1]))
      );
    } else if (!state) {
      const state = new Y.Map();
      Object.entries(model).map(entry =>
        state.set(entry[0], JSONExt.deepCopy(entry[1]))
      );
      yfolder.set('randomnameforthecontext', state);
    }
  }

  export function createEmptyDirModel(): Contents.IModel {
    return {
      name: '',
      path: '',
      created: new Date().toISOString(),
      last_modified: new Date().toISOString(),
      format: null,
      mimetype: '',
      content: null,
      writable: true,
      type: 'directory'
    };
  }
}
