This folder holds components that render the contents of RawSearchResult
instances as returned by server.js' normalize_search_results.js transform.

While they may include up-sells to more advanced Notebook Sheets, they will
never directly deal in richer representations.  That said, they've now gotten
reasonably fancy looking and they may get forked into more full-featured
versions.

With the sorch refactor, this is the hierarchy of the results and how they map:
- { files, semantic } : `raw_results.jsx`, displays a tab for each of these.
- semantic:
  - dict with `raw symbol` key and `symbol info` value:

The nesting hierarchy goes like (outer to inner), with props:
- raw_results.jsx { rawResults }
- hit_dict.jsx { hitDict, contentFactory }
- symbol_hit.jsx { symbolName, hitDict }
- hit_dict.jsx { hitDict, contentFactory } (reused from above)
- path_hit_list.jsx { pathHits }
- path_hit.jsx { pathHit }
- line_hit.jsx { lineHit }
