#!/bin/bash

mkdir -p build
cd build
eosio-cpp \
  -R ../src/ricardian \
  -o zigzag.wasm \
  ../src/zigzag.cpp \
  --abigen
