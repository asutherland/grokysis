# Searchfox Code Understanding Core Logic

## Goal

Searchfox is great.  More can be done using user-driven visualization to aid in
personal understanding and sharing the byproducts of that.

## What's this directory?

This directory houses:
- Dumb searchfox-communication logic.  Simple glue to talk to searchfox.
- Functionality Shims that pretend searchfox exposes something that might be a
  good enhancement for Searchfox to index/pre-compute/etc. but maybe is just
  dumb.
- Code analysis-specific logic.
- No actual UI logic.  That's handled by other directories, see below.

This directory interacts with the following sibling directories:
- graph-ui: An interactive UI widget built on graphviz/viz.js/graph-viz-d3-js
  that provides a means of incrementally growing/refining a graph from the
  underlying (huge) graph that is the codebase and all of its edges and nodes.
- notebook-ui: Eventually, a poor person's mash-up of jupyter/IPython-style
  notebooks and Tiddlywiki.  The idea is that you might create a separate
  notebook for various efforts at understanding Gecko, and this is a somewhat
  decouple higher-level UI that makes it possible to include multiple orthogonal
  graphs, or include log analyses, or crashes, or something.
- ../fancy-ui: This currently glues everything together, probably.