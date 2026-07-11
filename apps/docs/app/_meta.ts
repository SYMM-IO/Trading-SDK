/**
 * Top-level navigation for the SYMM Frontier docs.
 *
 * The keys correspond to directories under `app/`. Introduction and Guides are
 * shared across every library; each library owns its own Getting Started (see
 * `app/<lib>/getting-started`), which the switcher scopes in with the rest of
 * that library's pages. The library switcher (`app/library-switcher.tsx`) sits
 * at the top of the sidebar and scopes the pages below to a single package at a
 * time: the `data-doc-lib` rules in `globals.css` hide the other libraries and
 * flatten the selected one (its folder header is dropped since the switcher
 * already names it).
 */
export default {
  index: { title: "Home", display: "hidden" },
  introduction: "Introduction",
  guides: "Guides",
  core: "Core",
  react: "React",
  utils: "Utils",
  "session-key": "Session Key",
};
