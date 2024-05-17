"use strict";

const {newConfigBuilder} = require("webpack-config-builder");
const path = require("path");

const pkg = require("./package.json");

const pathBuild = path.resolve(__dirname, "dist");

module.exports = newConfigBuilder()
    .withCss("index.css")
    .withAttributionsPath("ATTRIBUTION.json")
    .withDefine("BUILD_TYPE", "release", "debug")
    .withDefine("BUILD_VERSION", pkg.version)
    .asLibrary("umd", "rustcircuit")
    .compile("web", "/src/index.ts", pathBuild, "index.js");