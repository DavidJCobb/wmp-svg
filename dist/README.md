
Minified source files.

## CSS

CSS files were minified using [minifier.org](https://www.minifier.org/), a web-based version of `matthiasmullie/minify`. Note that pasting CSS content into the minifier may cause it to automatically switch to JavaScript, switching back to CSS automatically after you perform an incorrect minification. Make sure you manually select "CSS" before clicking the button.

The minifier doesn't handle the following cases; they must be dealt with manually:

* Extra whitespace in CSS grid template area strings
* Extra whitespace in some custom property values

## JavaScript

JavaScript files were minified using [this site](https://minify-js.com/), which is based on Terser v5.20.0. The `keep_classnames` and `keep_fnames` settings were enabled, and the ECMA version specified was `5`.

Custom element files with HTML strings inside were (understandably) not fully minified: whitespace was preserved within the strings, as was a `trim()` call. These were dealt with by hand.

## SVG

SVG files were minified by hand, via the following regex replace operations (in order):

* `<!--.+?-->` (multi-line regex) to blank
* `\r\n` to ` `
* `\s{2,}` to ` `
* `> <` to `><`

Judging just the top half of the first page of Google results (since that was enough for the other languages), online minifiers for XML are generally poor (e.g. failing to remove whitespace within tags, or failing to even remove comments), while minifiers for SVG are generally untrustworthy (e.g. removing `id` attributes from `view` elements; *what the actual hell?*), so I just relied on Notepad++.