import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import { sync as inlineSync } from "inline-source";
import { minify } from "html-minifier";
import license from "rollup-plugin-license";
import handlebars from "handlebars";

function parseAndBundleExample() {
    const fs = require("fs");

    // Copy example CSS
    fs.writeFileSync("./build/cv.css", fs.readFileSync("./example/cv.css"));

    // Fill the example template with the example data and write it to the build folder
    const cvTemplate = handlebars.compile(fs.readFileSync("./example/cv.hbs").toString());
    const cvData = JSON.parse(fs.readFileSync("./example/cv-data.json"));
    const cvHtml = cvTemplate(cvData);
    fs.writeFileSync("./build/cv.html", cvHtml);

    // Inline all of the external resources in the built html and save it with another name
    var cvBundledHtml = inlineSync("./build/cv.html", {
        attribute: false,
        compress: false,
    });
    fs.writeFileSync("./build/cv-bundled.html", cvBundledHtml);

    // Minify the bundled html and save it with another name again
    fs.writeFileSync(
        "./build/cv-bundled-minified.html",
        minify(cvBundledHtml, {
            minifyJS: true,
            minifyCSS: true,
            collapseWhitespace: true,
            conservativeCollapse: true,
        })
    );
}

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
    plugins: [
        resolve(),
        license(licenseOptions),
        babel({
            presets: [
                [
                    "env",
                    {
                        targets: {
                            browsers: ["last 2 versions", "ie >= 11"],
                        },
                        modules: false,
                    },
                ],
            ],
            plugins: ["external-helpers"],
        }),
        {
            name: "html-bundler",
            onwrite: parseAndBundleExample,
        },
    ],
};
