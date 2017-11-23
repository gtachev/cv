import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import { sync as inlineSync } from "inline-source";
import { minify } from "html-minifier";
import license from "rollup-plugin-license";
const fs = require("fs");

var bundleExampleHtml = {
    name: "html-bundler",
    onwrite: function() {
        var html = inlineSync("./example/index.html", {
            attribute: false,
            compress: false,
        });

        fs.writeFileSync("./build/index-bundled-uncompressed.html", html);

        fs.writeFileSync(
            "./build/index-bundled-compressed.html",
            minify(html, {
                minifyJS: true,
                minifyCSS: true,
                collapseWhitespace: true,
                conservativeCollapse: true,
            })
        );
    },
};

const licenseOptions = {
    banner: `\
Bundle of <%= pkg.name %> by <%= pkg.author.name %>
Generated: <%= moment().format('YYYY-MM-DD') %>
Version: <%= pkg.version %>
License: <%= pkg.license %>
Used dependencies:
<% _.forEach(dependencies, function (dependency) { %>
   <%= dependency.name %> <%= dependency.version %> by <%= dependency.author.name %> with <%= dependency.license %> license \
<% }) %>`,
};

export default {
    input: "src/main.js",
    output: {
        file: "build/bundle.js",
        format: "iife",
        name: "cv",
    },
    sourcemap: true,
    plugins: [resolve(), license(licenseOptions), babel(), bundleExampleHtml],
};
