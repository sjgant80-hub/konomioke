#!/bin/bash
# Build bundle.js from nested phase directories
cat \
  js/globals.js \
  js/p2-identity/identity.js \
  js/p11-tracks/crdt-queue.js \
  js/p3-mesh/mesh.js \
  js/p5-fabric/fabric.js \
  js/p7-vocal/vocal.js \
  js/p11-tracks/tracks.js \
  js/p13-viz/viz.js \
  js/p17-app/app.js \
  js/p17-app/boot.js \
  > js/bundle.js
echo "bundle.js: $(wc -l < js/bundle.js) lines"
node --check js/bundle.js 2>/dev/null && echo "OK" || echo "SYNTAX ERROR"
