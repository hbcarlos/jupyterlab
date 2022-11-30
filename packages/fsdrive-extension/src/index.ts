// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module fsdrive-extension
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, ToolbarButton } from '@jupyterlab/apputils';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ITranslator } from '@jupyterlab/translation';

import {
  filterListIcon,
  folderIcon,
  listIcon,
  shareIcon
} from '@jupyterlab/ui-components';

import { FileSystemClientDrive } from './clientDrive';

import { FileSystemDrive } from './drive';

/**
 * Initialization data for the jupyterlab-filesystem-access extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/fsdrive-extension:plugin',
  requires: [IFileBrowserFactory, ITranslator],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    browser: IFileBrowserFactory,
    translator: ITranslator
  ) => {
    if (!window.showDirectoryPicker) {
      // bail if the browser does not support the File System API
      console.warn(
        'The File System Access API is not supported in this browser.'
      );
      return;
    }

    const { serviceManager } = app;
    const { createFileBrowser } = browser;

    const trans = translator.load('jupyterlab-filesystem-access');
    const drive = new FileSystemDrive();
    serviceManager.contents.addDrive(drive);

    const clientDrive = new FileSystemClientDrive();
    serviceManager.contents.addDrive(clientDrive);

    const widget = createFileBrowser('jp-filesystem-browser', {
      driveName: drive.name,
      // We don't want to restore old state, we don't have a drive handle ready
      restore: false
    });
    widget.title.caption = trans.__('Local File System');
    widget.title.icon = listIcon;

    const openDirectoryButton = new ToolbarButton({
      icon: folderIcon,
      tooltip: trans.__('Open a new folder'),
      onClick: async () => {
        const directoryHandle = await window.showDirectoryPicker();

        if (directoryHandle) {
          drive.rootHandle = directoryHandle;

          // Go to root directory
          widget.model.cd('/');
        }
      }
    });

    widget.toolbar.insertItem(0, 'open-directory', openDirectoryButton);

    const shareButton = new ToolbarButton({
      icon: shareIcon,
      tooltip: trans.__('Open remote file system'),
      onClick: async () => {
        const widget = createFileBrowser('jp-filesystem-client-browser', {
          driveName: clientDrive.name,
          restore: false
        });
        widget.title.caption = trans.__('Local File System');
        widget.title.icon = filterListIcon;

        app.shell.add(widget, 'left');

        InputDialog.getText({
          title: 'Room ID',
          text: 'random-room-id-for-testing-jupyterlab'
        }).then(value => {
          if (value.value) {
            clientDrive.roomID = value.value;
          } else {
            clientDrive.roomID = '';
          }

          widget.model.cd('/');
        });
      }
    });

    widget.toolbar.insertItem(1, 'share', shareButton);

    app.shell.add(widget, 'left');
  }
};

export default plugin;
