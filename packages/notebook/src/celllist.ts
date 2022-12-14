// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  CellModel,
  CodeCellModel,
  ICellModel,
  MarkdownCellModel,
  RawCellModel
} from '@jupyterlab/cells';
import { IObservableList } from '@jupyterlab/observables';
import {
  ISharedCell,
  ISharedCodeCell,
  ISharedMarkdownCell,
  ISharedNotebook,
  ISharedRawCell,
  NotebookChange
} from '@jupyter-notebook/ydoc';
import { ISignal, Signal } from '@lumino/signaling';

/**
 * A cell list object that supports undo/redo.
 */
export class CellList {
  /**
   * Construct the cell list.
   */
  constructor(protected model: ISharedNotebook) {
    this.model.cells.forEach(cell => {
      const model = this._createCellModel(cell);
      this._cellMap.set(cell, model);
    });

    this.model.changed.connect(this._onSharedModelChanged, this);
  }

  /**
   * A signal emitted when the cell list has changed.
   */
  get changed(): ISignal<this, IObservableList.IChangedArgs<ICellModel>> {
    return this._changed;
  }

  /**
   * Test whether the cell list has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Get the length of the cell list.
   *
   * @returns The number of cells in the cell list.
   */
  get length(): number {
    return this.model.cells.length;
  }

  /**
   * Create an iterator over the cells in the cell list.
   *
   * @returns A new iterator starting at the front of the cell list.
   */
  *[Symbol.iterator](): IterableIterator<ICellModel> {
    for (const cell of this.model.cells) {
      yield this._cellMap.get(cell)!;
    }
  }

  /**
   * Dispose of the resources held by the cell list.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;

    // Clean up the cell map and cell order objects.
    for (const cell of this.model.cells) {
      this._cellMap.get(cell)?.dispose();
    }
    Signal.clearData(this);
  }

  /**
   * Get the cell at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @returns The cell at the specified index.
   */
  get(index: number): ICellModel {
    return this._cellMap.get(this.model.cells[index])!;
  }

  private _createCellModel(sharedModel: ISharedCell): CellModel {
    let cellModel: CellModel;
    switch (sharedModel.cell_type) {
      case 'code': {
        cellModel = new CodeCellModel({
          sharedModel: sharedModel as ISharedCodeCell
        });
        break;
      }
      case 'markdown': {
        cellModel = new MarkdownCellModel({
          sharedModel: sharedModel as ISharedMarkdownCell
        });
        break;
      }
      default: {
        cellModel = new RawCellModel({
          sharedModel: sharedModel as ISharedRawCell
        });
      }
    }
    return cellModel;
  }

  private _onSharedModelChanged(self: ISharedNotebook, change: NotebookChange) {
    // This doesn't support transactions where there is a move together with
    // other operation.
    // A move operation has to be in its own transaction.
    console.debug("CellList._onSharedModelChanged", change.cellsChange);

    if (change.cellsChange) {
      const added = change.cellsChange?.added;
      const deleted = change.cellsChange?.deleted;
      added.forEach(item => {
        if (!this._cellMap.has(item)) {
          const cellModel = this._createCellModel(item);
          this._cellMap.set(item, cellModel);
        }
      });
      deleted.forEach(item => {
        const model = this._cellMap.get(item);
        if (model) {
          model.dispose();
          this._cellMap.delete(item);
        }
      });

      let currpos = 0;
      // We differ emitting the list changes to ensure cell model for all current shared cell have been created.
      const events = new Array<IObservableList.IChangedArgs<ICellModel>>();
      change.cellsChange.delta.forEach(d => {
        if (d.insert != null && d.insert.length != added.size) {
          // MOVE
          const deltas = change.cellsChange!.delta;
          let oldIndex = 0;
          for (let i=0; i<deltas.length; i++) {
            const delta = deltas[i];
            if (delta.insert) {
              oldIndex += delta.insert.length;
            } else if (delta.retain){
              oldIndex += delta.retain;
            } else {
              break;
            }
          }
          console.debug("MOVE: insert", currpos, oldIndex);

          events.push({
            type: 'move',
            newIndex: currpos,
            newValues: d.insert.map(c => this._cellMap.get(c)!),
            oldIndex,
            oldValues: d.insert.map(c => this._cellMap.get(c)!)
          });

        } else if (d.delete != null && d.delete != deleted.size) {
          // MOVE
          // Handled in insert
          console.debug("MOVE: delete");

        } else if (d.insert != null) {
          events.push({
            type: 'add',
            newIndex: currpos,
            newValues: d.insert.map(c => this._cellMap.get(c)!),
            oldIndex: -2,
            oldValues: []
          });

          currpos += d.insert.length;
        } else if (d.delete != null) {
          events.push({
            type: 'remove',
            newIndex: -1,
            newValues: [],
            oldIndex: currpos,
            // Cells have been disposed, so we don't know which one are gone.
            oldValues: new Array(d.delete).fill(undefined)
          });
        } else if (d.retain != null) {
          currpos += d.retain;
        }
      });

      console.debug("SharedModels:");
      this.model.cells.forEach(cell => {
        console.debug(cell);
        console.debug(this._cellMap);
        debugger;
        const cellModel = this._cellMap.get(cell)!;
        console.debug("Disposed:", cellModel.isDisposed, cellModel.id);
      });
      events.forEach(msg => this._changed.emit(msg));
    }
  }

  private _cellMap = new WeakMap<ISharedCell, ICellModel>();
  private _changed = new Signal<this, IObservableList.IChangedArgs<ICellModel>>(
    this
  );
  private _isDisposed = false;
}
