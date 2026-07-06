/**
 * Top-level navigation for the SYMM Frontier docs.
 *
 * The keys correspond to directories under `app/`. Each entry's `type` and
 * `title` control how Nextra's Navbar renders it. The three SDK packages
 * appear as top-nav tabs so a developer can pick a library and stay inside
 * that section's sidebar.
 */
export default {
  index: { title: "Home", display: "hidden" },
  introduction: "Introduction",
  "getting-started": "Getting Started",
  guides: "Guides",
  "-- libraries": {
    type: "separator",
    title: "Libraries",
  },
  core: "Core",
  react: "React",
  utils: "Utils",
  "session-key": "Session Key",
};
