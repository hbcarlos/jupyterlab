import { Contents, ServerConnection } from '@jupyterlab/services';

import { JSONExt } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import { WebrtcProvider } from 'y-webrtc';

import { Awareness } from 'y-protocols/awareness';

import * as Y from 'yjs';

export const DRIVE_NAME = 'FileSystemClient';

export class FileSystemClientDrive implements Contents.IDrive {
  private _isDisposed = false;
  private _fileChanged = new Signal<Contents.IDrive, Contents.IChangedArgs>(
    this
  );

  private _ydoc: Y.Doc = new Y.Doc();
  private _root: Y.Map<Y.Doc | Y.Map<any>> = this._ydoc.getMap('root');
  private _provider: WebrtcProvider;

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

  set roomID(id: string) {
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
    if (!this._root.has('randomnameforthecontext')) {
      return Private.createEmptyDirModel();
    }

    const yItem = await this._getItem(path);

    if (yItem instanceof Y.Doc) {
      const state = (yItem as Y.Doc).get('state');
      return JSONExt.deepCopy(state.toJSON());
    } else {
      const state: Y.Map<any> = yItem.get('randomnameforthecontext');
      if (state) {
        const model: Contents.IModel = JSONExt.deepCopy(state.toJSON()) as any;
        return model;
      }

      return Private.createEmptyDirModel();
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

  private _getItem(path: string): Y.Map<any> | Y.Doc {
    if (!this._root.has('randomnameforthecontext'))
      throw new Error('No root file handle');

    if (path.length == 0) {
      return this._root;
    }

    let yItem = this._root as any;
    for (const subPath of path.split('/')) {
      yItem = yItem.get(subPath);
    }

    return yItem;
  }
}

namespace Private {
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
