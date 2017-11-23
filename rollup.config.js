import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import { sync as inlineSync } from "inline-source";
import { minify } from "html-minifier";

var bundleExampleHtml = {
    name: "html-bundler",
    onwrite: function() {
        var fs = require("fs");
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

export default {
    input: "src/main.js",
    output: {
        file: "build/bundle.js",
        format: "iife",
        name: "cv",
    },
    sourcemap: true,
    plugins: [resolve(), babel(), bundleExampleHtml],
};
