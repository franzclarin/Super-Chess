import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@super-chess/chess-core'],
  webpack(cfg, { isServer }) {
    if (!isServer) {
      cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false };
    }
    cfg.experiments = { ...cfg.experiments, asyncWebAssembly: true };
    return cfg;
  },
};

export default config;
