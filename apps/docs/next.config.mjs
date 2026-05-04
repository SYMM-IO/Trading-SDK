import nextra from "nextra";

// Set up Nextra with its configuration
const withNextra = nextra({
  // ... Add Nextra-specific options here
});

// Export the final Next.js config with Nextra included
export default withNextra({
  // ... Add regular Next.js options here
});

// import nextra from 'nextra'

// const withNextra = nextra({
//   latex: true,
//   search: {
//     codeblocks: false
//   }
// })

// export default withNextra({
//   reactStrictMode: true,
//   output: 'standalone',
//   typescript: {
//     ignoreBuildErrors: true,
//   },
//   eslint: {
//     ignoreDuringBuilds: true,
//   },
// })
