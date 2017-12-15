To make it a proper FOSS project that is usable by other people:

* Write a README with proper description, explanations and instructions.
* Split the D3.js library from the HTML/CSS of the CV itself? Release it on npm? In any case, the current project folder structure should be improved.
* Improve the build (bundling) system so CSS resources aren't hardcoded as base64 URIs. Something like [assetgraph](https://github.com/assetgraph/assetgraph) would probably be a better fit.
* Use other data beside my own as an example?

Miscellaneous fixes and improvements:

* Fix the d3 zoom extent restriction (disallow panning to the right)
* Add zoom-in/zoom-out/reset buttons and indicators to the timeline.
* Code cleanup - resolve TODOs, remove commented-out portions of code, unused HTML attributes and CSS, change misleading variable names, etc. Maybe use something like [uncss](https://github.com/giakki/uncss)?
* Fix the printing of the timeline work/edu/project labels in non-chromium browsers (this would probably be much easier if we don't use SVG).
* Link timeline places to the other pages?
* Add the ability to reorder skills in the timeline and to show all extra skill with one click?

Long-term:

* Use chromium headless(https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagepdfoptions) to automatically generate the pdf CV every build?
* Do not use D3.js for the timeline? The library is superb, but is a total overkill for such a simple use case. Alternatively, use D3, just with HTML instead of SVG.
* The build/bundle script can save a static copy of the timeline inside the built HTML so that it's shown without JS, even if only as a static object.
