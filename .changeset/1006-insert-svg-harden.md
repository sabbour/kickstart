---
"@aks-kickstart/web": patch
---

Harden `insertSvgSafely` against three SVG-borne XSS vectors identified in #1006:

- Strip `javascript:` URLs (including whitespace, tab/newline, and
  percent-encoded obfuscation) from `href` / `xlink:href` on `<a>`, `<image>`,
  and `<use>` elements.
- Remove `<use>` elements whose `href` points at an external document
  (`data:`, `http(s):`, protocol-relative `//`). Same-document `#fragment`
  references continue to work.
- Remove `<foreignObject>` elements wholesale — they embed arbitrary HTML and
  are an easy escape hatch.

All three strips operate on a DOM parsed via `DOMParser(image/svg+xml)` and
are never applied to the raw SVG string.
