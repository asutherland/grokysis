## Graphing

Need:
- **"Calls" edges without having to scrape the source while parsing**
  - This could happen via aggregating these edges into a symbol info that would
    have a huge hunk of information, but that could be a lot, and without the
    indexer filtering out boring stuff, could really get huge.
  - Potentially better is to make the file analysis results explicitly include
    nesting so that the analysis file is basically an AST.
    - This will directly provide position:sticky capabilities as well as making
      things easier for tooling.
    - It could also then make sense to maybe just expose the enriched analysis
      files directly, along-side the HTML?  Or maybe the HTML just with semantic
      mark-up is really fine too.  (The argument it's not fine is that it makes
      it harder for workers to do stuff.)

## Crash Analysis related
[ ] Get the crash details sheet showing the list of threads in a crash.


### Use-case
Want to analyze the cases where the http manager is in shutdown and blocked on
the Socket Thread.  So we want to:
- Paste in the signatures for the http manager, no need to include the misses.
- Have it filter to the "Socket Thread" across all of those.
- Aggregate those into a flame graph.

## Searchfox File Exploration
A whole-page mode with a top-bar or side-bar (depending on aspect ratio) that
displays:
- A straight-up current breadcrumb traversal.  This updates as the back button
  (or equivalent) is used, popping things off the traversal.  This also has
  finite depth, so eventually this get removed.
- A graph of all edges followed during the current exploration.

Exploration / navigation takes the form of:
- Whole-page search results using the react 'raw' widgets.
- Context menu is of course the fancy one, but with "eyeball replacement"
  traversal "navigating" the page.
  - Things that spawn other sheets should (eventually) go to a linked window via
    window.open.  This does have session implications, as the other window
    either wants to be a full session, or we want to treat the full-page view as
    a "track" that's mutually exclusive with the default set.
    - A-ha!  Yeah.  We have one track for full-page views.  Each sheet is a page
      on its own.
- Traversals add an edge in the graph.  Some UI is added to delete boring edges
  or nodes (which really means clearing out all its edges).

## Searchfox Fancy Search Graph

### Example use-cases

#### `GetUsage`

Has a nice set of related and unrelated things that could have some graphing.
