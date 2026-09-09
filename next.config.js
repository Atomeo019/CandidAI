/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },

  // Baseline security headers on every route.
  //
  // Deliberately NOT a Content-Security-Policy: Clerk, Groq, Google Fonts and
  // the Whop checkout redirect all need allowlisting, and a half-written CSP
  // breaks sign-in in ways that only show up in production. The three below are
  // unconditionally safe and cost nothing.
  //
  // X-Frame-Options DENY is the one that matters here: without it the sign-in
  // page, the claim-purchase form and the checkout redirect could all be framed
  // invisibly on another origin and clickjacked.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // pdf-parse ships its own bundled pdfjs v1.x inside lib/pdf.js/{version}/build/.
  // It loads them with a template literal: require(`./pdf.js/${version}/build/pdf.js`)
  // Webpack can't statically trace template literals, so those files never get
  // bundled. Vercel's output file tracer also misses them for the same reason.
  //
  // Two-part fix:
  // 1. serverExternalPackages — prevents webpack from touching pdf-parse at all.
  //    Node.js native require() handles it, resolving relative paths correctly
  //    from node_modules/pdf-parse/lib/. Renamed from the Next 13/14 name
  //    `experimental.serverComponentsExternalPackages`; stable and top-level in 15.
  // 2. outputFileTracingIncludes — force Vercel to ship all of pdf-parse's
  //    bundled pdfjs files so they exist on disk at /var/task/node_modules/ when
  //    the serverless function runs.
  //
  // `experimental.serverActions: true` was removed here: Server Actions are
  // stable in Next 15 and the flag no longer exists. It was only ever present
  // because @clerk/nextjs uses a Server Action internally.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  experimental: {
    outputFileTracingIncludes: {
      '/api/analyze': [
        // pdf-parse ships pdfjs v1.x via template literal requires — tracer misses them
        './node_modules/pdf-parse/lib/**/*',
        // pdfjs-dist legacy build — used as fallback when pdf-parse fails on valid PDFs
        // (e.g. ReportLab-generated PDFs that trigger false-positive XRef errors in pdfjs v1.x)
        './node_modules/pdfjs-dist/legacy/build/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
