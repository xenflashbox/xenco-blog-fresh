import { withPayload } from '@payloadcms/next/withPayload'
import { execSync } from 'child_process'

// Stable build ID based on git commit hash.
// Server Action IDs include the build ID, so this prevents hash mismatches
// after rolling updates in Docker Swarm — users with cached JS can still
// call the same Server Actions as long as the deployed code hasn't changed.
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    // Fallback for Docker build environments where .git may not be present
    return process.env.GIT_COMMIT_HASH || 'unknown'
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Deterministic build ID — prevents Server Action hash churn on rolling updates.
  // Without this, every `next build` generates a new random build ID, which changes
  // all Server Action hashes and causes "Failed to find Server Action" errors for
  // users whose browser has cached JS from the previous deployment.
  generateBuildId: getGitCommitHash,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
