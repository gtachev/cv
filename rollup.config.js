import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import { sync as inlineSync } from "inline-source";
import { minify } from "html-minifier";
import license from "rollup-plugin-license";
import handlebars from "handlebars";
//import "handlebar-helpers";

handlebars.registerHelper("replace", function(str, search, replace) {
    return new handlebars.SafeString(str.replace(new RegExp(search, "g"), replace));
});

function transformCvData(data) {
    let education = new Map(data.education.map(i => [i.id, i]));
    let work = new Map(data.work.map(i => [i.id, i]));
    data.projects.forEach(p => {
        if (!p.where) {
            return;
        }
        if (work.has(p.where)) {
            p.placeType = "work";
            p.place = work.get(p.where);
        } else {
            p.placeType = "education";
            p.place = education.get(p.where);
        }
        if (!p.place.projects) {
            p.place.projects = [];
        }
        p.place.projects.push(p);
    });
    [...data.projects, ...data.work, ...data.education].forEach(i => {
        if (!i.skills) {
            return;
        }
        let skills = new Set();
        i.skills.forEach(s => {
            if (skills.has(s.name)) {
                s.hideInList = true;
            } else {
                skills.add(s.name);
            }
        });
    });
    return data;
}

function parseAndBundleExample() {
    const fs = require("fs");

    // Copy example CSS
    fs.writeFileSync("./build/cv.css", fs.readFileSync("./example/cv.css"));

    // Fill the example template with the example data and write it to the build folder
    const cvTemplate = handlebars.compile(fs.readFileSync("./example/cv.hbs").toString());
    const cvData = transformCvData(JSON.parse(fs.readFileSync("./example/cv-data.json")));
    const cvHtml = cvTemplate(cvData);
    fs.writeFileSync("./build/cv.html", cvHtml);

    // Inline all of the external resources in the built html and save it with another name
    var cvBundledHtml = inlineSync("./build/cv.html", {
        swallowErrors: true, //TODO: fix fonts, remove jquery
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
            removeComments: true
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
