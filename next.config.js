/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow static HTML files from public/ to be served
  trailingSlash: false,
  // Disable React strict mode for production
  reactStrictMode: true,
};

module.exports = nextConfig;
