#!/bin/sh
# Run some necko tests to generate log output that can be used for expected
# output tests for running logan against them.
#
# This script should be run from the root of a Gecko checkout with MOZCONFIG
# already appropriately configured.
SCRIPT_DIR=$( dirname "$(readlink -f "$0")" )
LOGAN_DIR=$( dirname "$SCRIPT_DIR" )

LOG_OUT=${LOGAN_DIR}/test/expected/simple_http2_input.log
# the http2 test uses a node.js server, and needs to be run sequentially
TESTFLAGS=--sequential
TESTNAME=netwerk/test/unit/test_http2.js
# nsHttp:5 is way too verbose because it includes data, so we use 3.
# nsSocketTransport:5 too... it includes polling details.
# cache2:5 as well... there's just too much of it
MOZ_LOG=timestamp,sync,nsHttp:3,cache2:3,DocumentLeak:5,PresShell:5,DocLoader:5,nsDocShellLeak:5,RequestContext:5,LoadGroup:5,nsSocketTransport:3
NODE=$( which node )

echo "using node ${NODE}"
echo "updating log ${LOG_OUT}"
MOZ_LOG=${MOZ_LOG} MOZ_NODE_PATH=${NODE} ./mach xpcshell-test --log-raw="${LOG_OUT}" ${TESTFLAGS} ${TESTNAME}