import EE from 'eventemitter3';

/**
 * Live-updating KnowledgeBase info about a symbol.
 *
 * Properties:
 * - typeLetter / type:
 *   - p: protocol
 *   - i: interface
 *   - c: class
 *   - m: method
 *   - f: field
 *   - o: object, for JS object things
 *   - ?: unknown
 *
 */
export default class SymbolInfo extends EE {
  constructor() {
    super();

    this.serial = 0;

    this.typeLetter = '?';
    this.type = 'unknown';
  }
}