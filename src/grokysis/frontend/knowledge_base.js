import SymbolInfo from './kb/symbol_info.js';

/**
 * Hand-waving source of information that's not spoon-fed to us by searchfox or
 * lower level normalization layers.  This means a home for:
 * - weird hacky heuristics
 * - stuff the user told us
 *
 * It's likely that much of this logic should be pushed into the back-end, but
 * for now the split is that the backend is used for deterministic request/reply
 * semantics and this class and its helpers are where state aggregation and
 * snooping-with-side-effects happens.
 *
 * We provide for the following known facts:
 * - Thread-in-use: Determined by heuristics based on assertions or from hacky
 *   external 
 *
 */
export default class KnowledgeBase {
  constructor() {
    this.symbolsByPrettyName = new Map();
  }

  /**
   * Synchronously return a SymbolInfo that will update as more information is
   * gained about it.
   */
  lookupSymbol(prettyName) {
    let symInfo = this.symbolsByPrettyName.get(prettyName);
    if (symInfo) {
      return symInfo;
    }

    symInfo = new SymbolInfo({ prettyName });
    this.symbolsByPrettyName.set(prettyName, symInfo);


  }
};