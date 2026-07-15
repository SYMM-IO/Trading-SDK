# SYMM Trading-SDK Documentation

Documentation site built with [Nextra](https://nextra.site/) 4.x.

## Setup Complete

The docs app has been configured with:

- **Nextra 4.x** with Next.js App Router
- **nextra-theme-docs** for styling
- Proper layout with `getPageMap()` integration
- Three sample pages (Home, Introduction, Getting Started)

## Running the Dev Server

```bash
cd apps/docs
pnpm dev
```

The docs will be available at `http://localhost:3002`.

**Note:** If you encounter port permission errors, you may need to:

- Run with sudo (not recommended)
- Change the port in `package.json` to a higher number (e.g., 8002)
- Or run from the monorepo root: `pnpm dev` (Turborepo will handle all apps)

## Building

```bash
pnpm build
```

## Project Structure

```
apps/docs/
├── app/
│   ├── layout.tsx              # Root layout with Nextra theme
│   ├── page.mdx                # Home page
│   ├── introduction/
│   │   └── page.mdx            # Introduction page
│   └── getting-started/
│       └── page.mdx            # Getting started guide
├── mdx-components.tsx          # MDX components configuration
├── next.config.mjs             # Nextra configuration
└── package.json
```

## Adding New Pages

Create new `.mdx` files in the `app/` directory following Next.js App Router conventions:

- `app/guide/page.mdx` → `/guide`
- `app/api/reference/page.mdx` → `/api/reference`

## Features

- ✅ Nextra theme with sidebar navigation
- ✅ Dark/light mode toggle
- ✅ Search functionality
- ✅ Responsive design
- ✅ Code syntax highlighting
- ✅ MDX support

## Learn More

- [Nextra Documentation](https://nextra.site/)
- [Next.js App Router](https://nextjs.org/docs/app)
