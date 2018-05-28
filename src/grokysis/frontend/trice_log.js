import EE from 'eventemitter3';

export default class TriceLog extends EE {
  constructor({ events, config }) {
    super();

    this.serial = 0;

    /**
     * The events as parsed out of the nd-json file, unfiltered, but with some
     * normalizations perormed in place that ideally would have happened during
     * trace generation.  In particular:
     * - Strings are normalized from `0xf00 "string"` to just `string`.  This
     *   is because the pretty printers are getting involved be helpful, but
     *   it's not actually that helpful.
     */
    this.rawEvents = events;
    /**
     * The (effective) TOML config file that was used to generate the trace and
     * may have display hints built-in.  By effective, I mean that this might
     * end up being the fusion of several separate TOML configs that were all
     * loaded at the same time (which deal with orthogonal details).
     */
    this.rawConfig = config;

    /**
     * List of the breakpoints we observed and summary statistics over the
     * time-scales, with those that had `facetBy` entries in the toml config
     * containing self-similar child nodes that contain similar statistics.
     */
    this.filterableFacets = [];

    /**
     * We filter out any events for which any of these functions return true.
     */
    this.filterExcludeFuncs = [];

    /**
     * The result of filtering/faceting rawEvents and producing vis.js timeline
     * items from the events.  These pair with `filteredVisGroups`.
     */
    this.filteredVisItems = [];
    /**
     * Paired with `filteredVisItems`, feed to vis.js
     */
    this.filteredVisGroups = [];

    // ## normalize rawEvents and find time bounds
    this.SCALE = 100;
    this.NBINS = 200;

    // Do min/max over all the events.  If the logs came from a single process,
    // we expect the first/last even to correspond to firstTick and lastTick,
    // but we expect to be dealing with multiple processes' traces and that
    // they may not actually be sorted.
    let firstTick = events[0].tick;
    let lastTick = events[0].tick;

    for (const event of events) {
      this.normalizeCaptured(event.captured);
      firstTick = Math.min(event.tick, firstTick);
      lastTick = Math.max(event.tick, lastTick);
    }
    this.firstTick = firstTick;
    this.lastTick = lastTick;

    // ## need the configuration to process the events
    this.processConfig(this.rawConfig);

    // ## compute the facets.
    this.deriveFilterableFacets();

    // ## perform an initial, un-filtered event processing.
    this.processEvents(this.rawEvents);
  }

  processConfig(config) {
    const bpSpecInfo = this.breakpointSpecToInfo = new Map();

    if (config.trace) {
      for (const [spec, cfg] of Object.entries(config.trace)) {
        const info = {};
        bpSpecInfo.set(spec, info);

        // ## `display` for the terse display format.
        // This is an array of arrays weird format right now.  This is partially
        // because toml requires homogeneous arrays.  The right thing is
        // some type of simplistic templating mechanism that resembles template
        // literals.  It would probably be wise to do this at the same time as
        // cleaning up the syntax for specifying gdb object traversals.
        if (cfg.display && Array.isArray(cfg.display)) {
          const normDisplay = cfg.display.map(piece => {
            if (Array.isArray(piece)) {
              switch (piece[0]) {
                case 'literal': {
                  const literal = piece[1];
                  return () => literal;
                }
                case 'lookup': {
                  const lookupKey = piece.slice(1).join('.');
                  return (event) => event.captured[lookupKey] || 'NOT PRESENT';
                }
                default: {
                  console.warn('unable to process config display op', piece[0]);
                  return () => 'CONFIG ERROR';
                }
              }
            } else {
              console.warn('unable to process config display piece', piece);
              return () => 'CONFIG ERROR';
            }
          });
          info.formatEvent = (event) => {
            let str = '';
            for (const segFunc of normDisplay) {
              str += segFunc(event);
            }
            return str;
          };
        } else {
          info.formatEvent = null;
        }

        if (cfg.facetBy) {
          info.facetBy = cfg.facetBy;
        } else {
          info.facetBy = [];
        }
      }
    }
  }

  /**
   * Toggle inclusion of a filter, re-processing all events synchronously.
   * (Although callers should not depend on that, but instead on the "dirty"
   * event being emitted at some point in the future.)
   *
   * @param {Boolean} [fromDisk=false]
   *   If this is coming from an existing disk representation, we don't
   *   trigger the persisted state dirty notification and we avoid performing
   *   processEvents() because we assume restoreState() will invoke it for us
   *   after the batch of changes finishes being applied.
   */
  toggleFilteringOutFacet(facet, fromDisk) {
    const idx = this.filterExcludeFuncs.indexOf(facet.filterExcludeFunc);
    if (facet.included) {
      // should not be in the list already then.
      if (idx !== -1) {
        throw new Error('filter present but should not be');
      }
      facet.included = false;
      this.filterExcludeFuncs.push(facet.filterExcludeFunc);
    } else {
      // should be in the list then
      if (idx === -1) {
        throw new Error('filter not present but should be');
      }
      facet.included = true;
      this.filterExcludeFuncs.splice(idx, 1);
    }

    if (!fromDisk) {
      this.emit('persistedStateDirty');
      this.processEvents();
    }
  }

  /**
   * Actual application of disk state to our in-memory state.
   *
   * The basic idea is:
   * - Traverse our disk facets in parallel with the facets we've derived from
   *   in-memory state.  If the data on disk didn't give rise to a facet, the
   *   memory of that facet basically evaporates.
   *   - This is not the best UX because there's the potential for user intent
   *     to evaporate over multipe sets of traces that lack specific events
   *     existing.
   *   - The rationale for doing this is to avoid the accumulation of hidden
   *     bogus state that could accumulate massive amounts of buggy data that's
   *     hidden from view.
   *   - Some type of more explicit categorization with bulk toggles that can be
   *     round-tripped back into the toml config and shared is probalby the way
   *     to go.  For example, there's a bunch of "http" and "image" observer
   *     events that would benefit from being grouped and these could
   *     potentially be further grouped into "network" and "graphics".
   */
  _applyDiskState(diskRep) {
    const traverseFacet = (diskFacet, facet) => {
      // Toggle if we don't match.
      if (diskFacet.included !== facet.included) {
        this.toggleFilteringOutFacet(facet, true);
      }

      // And traverse children.
      for (const kidDisk of diskFacet.children) {
        const kidFacet = facet.childrenByKey.get(kidDisk.name);
        if (!kidFacet) {
          continue;
        }

        traverseFacet(kidDisk, kidFacet);
      }
    };

    for (const diskFacet of diskRep.facets) {
      const facet = this.facetsByName.get(diskFacet.name);
      // Ignore facets that don't seem relevant to this trace.
      if (!facet) {
        continue;
      }
      traverseFacet(diskFacet, facet);
    }
  }

  restoreState(diskRep) {
    if (diskRep) {
      this._applyDiskState(diskRep);
      this.processEvents();
    }
  }

  toPersisted() {
    function mapFacet(facet) {
      const children = facet.children.map(mapFacet);
      return {
        name: facet.name,
        included: facet.included,
        children
      };
    }

    const diskFacets = this.filterableFacets.map(mapFacet);

    return {
      facets: diskFacets
    };
  }

  /**
   * Process the events, populating `this.filterableFacets` based on breakpoint
   * "spec"s at the top-level.  For each breakpoint and its resulting top-level
   * facet, we also consider any `facetBy` entries in the toml config for that
   * breakpoint and create child facets under the spec.  This does mean that
   * currently every breakpoint is independent even when it might be useful to
   * cluster common sub-facets.  Future work.
   */
  deriveFilterableFacets() {
    const NBINS = this.NBINS;

    // make a filter func just based on breakpoint spec
    function makeSpecFilter(spec) {
      return (event) => {
        return (event.spec === spec);
      };
    }

    // Make a filter func for a specific captured value for a sub-facet of a
    // facet for a specific breakpoint.  In the future we might not want to
    // constrain on the spec for groups of related breakpoints, but instead on a
    // manually labeled group name or something like that.
    function makeSpecCapturedFilter(spec, lookupKey, value) {
      return (event) => {
        return (event.spec === spec &&
                event.captured &&
                event.captured[lookupKey] === value);
      };
    }

    function makeFacet(name, filterExcludeFunc) {
      const facet = {
        name,
        count: 0,
        bins: new Array(NBINS),
        children: [],
        childrenByKey: new Map(),
        // true if the filterExcludeFunc isn't in filterExcludeFuncs, false if
        // it is.
        included: true,
        filterExcludeFunc
      };
      for (let i=0; i < NBINS; i++) {
        facet.bins[i] = 0;
      }
      return facet;
    }

    const topFacets = this.filterableFacets = [];
    const topBySpec = this.facetsByName = new Map();

    const firstTick = this.firstTick;
    const tickSpan = this.lastTick - this.firstTick;

    for (const event of this.rawEvents) {
      const spec = event.spec;
      let facet = topBySpec.get(spec);
      if (!facet) {
        facet = makeFacet(spec, makeSpecFilter(spec));
        topFacets.push(facet);
        topBySpec.set(spec, facet);
      }
      facet.count++;

      const useBin = Math.floor(NBINS * (event.tick - firstTick) / tickSpan);
      facet.bins[useBin]++;

      const info = this.breakpointSpecToInfo.get(spec);
      for (const facetDef of info.facetBy) {
        const lookupKey = facetDef.join('.');
        if (!(lookupKey in event.captured)) {
          continue;
        }

        const value = event.captured[lookupKey];
        let kidFacet = facet.childrenByKey.get(value);
        if (!kidFacet) {
          kidFacet = makeFacet(value,
                               makeSpecCapturedFilter(spec, lookupKey, value));
          facet.children.push(kidFacet);
          facet.childrenByKey.set(value, kidFacet);
        }
        kidFacet.count++;
        kidFacet.bins[useBin]++;
      }
      facet.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    topFacets.sort((a, b) => a.name.localeCompare(b.name));
    console.log('FACETS', this.firstTick, this.lastTick, tickSpan, topFacets);

    this.emit('facetsUpdated', this.filterableFacets);
  }

  formatEventContent(event, fallback) {
    const info = this.breakpointSpecToInfo.get(event.spec);
    if (!info || !info.formatEvent) {
      return fallback;
    }
    return info.formatEvent(event);
  }

  normalizeCaptured(captured) {
    if (!captured) {
      return;
    }

    for (const [key, value] of Object.entries(captured)) {
      // ## Extract the string payload from `0xf00 "actual string"``
      const strMatch = /^0x[0-9a-f]+ "(.+)"$/.exec(value);
      if (strMatch) {
        captured[key] = strMatch[1];
      }
    }
  }

  /**
   * Process events from rawEvents, filtering out those for which any of the
   * functions in `filterExcludeFuncs` return true, producing `filteredVisItems`
   * and `filteredVisGroups` suitable for consumption/display by vis.js'
   * timeline vis.
   */
  processEvents() {
    const events = this.rawEvents;
    const groups = this.filteredVisGroups = [];
    const items = this.filteredVisItems = [];

    const SCALE = this.SCALE;
    const firstTick = this.firstTick;

    const tidToGroup = new Map();

    // outer is a label that allows us to do `continue outer` below in order to
    // have `continue` target this outer loop rather than the inner loop.
    outer: for (let iEvent=0; iEvent < events.length; iEvent++) {
      const event = events[iEvent];

      for (const filterFunc of this.filterExcludeFuncs) {
        if (filterFunc(event)) {
          continue outer;
        }
      }

      const tid = event.tid;

      // ## ensure group
      let group = tidToGroup.get(tid);
      if (!group) {
        let tname = event.tname;
        if (/^mmap_hardlink/.test(tname)) {
          tname = 'Main Thread';
        }

        group = {
          id: tid,
          content: tname
        };
        groups.push(group);
        tidToGroup.set(tid, group);
      }

      // ## create item
      // persist the start for easier consultation.
      const content = this.formatEventContent(event, event.spec);
      event.start = Math.floor((event.tick - firstTick) / SCALE);
      const item = {
        id: iEvent,
        content,
        start: event.start,
        group: tid
      };
      items.push(item);
    }

    this.serial++;
    this.emit('dirty');
  }

  /**
   * Given a bin number, return the time as used for item.start that corresponds
   * to the center of the bin.
   */
  translateBinToItemTime(binNum) {
    const tickSpan = this.lastTick - this.firstTick;
    const binSpan = tickSpan / this.NBINS;
    const binTickMiddle = binSpan * (binNum + 0.5);
    // okay, that's in tick-space, but now we need to reduce by Scale and round.
    const scaled = Math.floor(binTickMiddle / this.SCALE);
    return scaled;
  }

  translateItemTimeToBin(itemTime) {
    // Multiplying by scale us in firstTick-relative space.
    const relTickTime = itemTime * this.SCALE;
    // So now it's about the bin.
    const tickSpan = this.lastTick - this.firstTick;
    const bin = Math.floor(this.NBINS * relTickTime / tickSpan);
    return bin;
  }
}
