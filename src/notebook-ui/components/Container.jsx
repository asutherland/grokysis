import React from 'react';

import NotebookSheet from './Sheet.jsx';

import './Container.css';

/**
 * A notebook container is full of NotebookSheet instances that wrap specific
 * widgets provided by the owner of the notebook so that they can be collapsed
 * and reordered.
 */
export default class NotebookContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      // Parallel arrays of NotebookSheet instances and their id's/keys.
      // This container is stateful due to the addition and removal of sheets,
      // but there are no meaningful state changes for the container or for the
      // NotebookSheet instances beyond that, so there's no real need for us to
      // be constantly creating ephemeral NotebookSheet stubs.
      sheets: [],
      sheetIds: [],
      nextId: 1
    };
  }

  componentDidMount() {
    // populate the initial set of sheets.
    if (this.props.initialSheets) {
      for (let sheetDef of this.props.initialSheets) {
        this.addSheet(null, sheetDef);
      }
    }
  }

  /**
   * Adds a new sheet.  This method is passed to sheet contentFactory instances
   * using a curried bind so that 'this' and 'relId' are automatically provided.
   * relId is used so that position values of "before" and "after" can be used
   * to insert sheets before/after the invoking sheet's position in the sheet
   * list.
   *
   * @param labelWidget
   *   React payload to display as the sheet's label.  This is passed as-is to
   *   the sheet's render method from the get-go.
   * @param [awaitContent]
   *    An optional Promise that delays the invocation of the contentFactory
   *    method until the content is available.  The name is chosen to make the
   *    asynchrony super explicit.
   * @param contentFactory
   *    A function that should take two arguments, props and content.  The
   *    function should return a React payload with the provided props spread
   *    into the component plus whatever else you put in there.  props is
   *    guaranteed to include an `addSheet` bound method that takes these
   *    same arguments (with this and relId already bound).  props is also
   *    guaranteed to include a `removeThisSheet` bound method, primarily
   *    intended for the NotebookSheet to use, although it should also pass it
   *    in to the content.
   * @param {'before'|'after'} position
   *    Where to place the sheet in relation to the triggering sheet.
   * @param [permanent=false]
   *    If true, the sheet shouldn't be removable.
   */
  addSheet(relId, { labelWidget, awaitContent, contentFactory, position,
                    permanent }) {
    this.setState((prevState, props) => {
      // - Determine where to insert the sheet.
      let targetIdx;
      if (relId === null) {
        targetIdx = prevState.sheets.length;
      } else {
        targetIdx = prevState.sheetIds.indexOf(relId);
        if (targetIdx === -1) {
          targetIdx = prevState.sheets.length;
        } else if (position && position === 'after') {
          // otherwise we're placing it before by using the existing sheet's
          // index.
          targetIdx++;
        }
      }

      const newId = prevState.nextId;
      const newSheets = prevState.sheets.concat();
      const newSheetIds = prevState.sheetIds.concat();

      // curry the sheet id.
      const boundAddSheet = this.addSheet.bind(this, newId);
      const boundRemoveSheet = this.removeSheet.bind(this, newId);

      const newSheet = (
        <NotebookSheet
          { ...this.props.passProps }
          key={ newId }
          labelWidget={ labelWidget }
          contentPromise={ awaitContent }
          contentFactory={ contentFactory }
          addSheet={ boundAddSheet }
          removeThisSheet={ boundRemoveSheet }
          permanent={ permanent }
          />
      );

      newSheetIds.splice(targetIdx, 0, newId);
      newSheets.splice(targetIdx, 0, newSheet);

      return {
        nextId: prevState.nextId + 1,
        sheets: newSheets,
        sheetIds: newSheetIds
      };
    });
  }

  /**
   * Asynchronously remove the sheet with the given id if it still exists.
   * Intended to be bind-curried to be provided as `removeThisSheet` to
   * NotebookSheet instances and their content payloads.
   */
  removeSheet(id) {
    this.setState((prevState, props) => {
      const idx = prevState.sheetIds.indexOf(idx);
      if (idx !== -1) {
        const newSheetIds = prevState.sheetIds.concat();
        const newSheets = prevState.sheets.concat();
        newSheetIds.splice(idx, 1);
        newSheets.splice(idx, 1);
      }
      return {
        sheets: newSheets,
        sheetIds: newSheetIds
      };
    })
  }

  render() {
    return (
      <div className="notebookContainer">
      { this.state.sheets }
      </div>
    );
  }
}