FROM node:20-alpine AS base
WORKDIR /app

# Copy manifests first for layer caching
COPY package.json turbo.json ./
COPY packages/chess-core/package.json ./packages/chess-core/
COPY apps/server/package.json ./apps/server/

RUN npm install --workspaces --include-workspace-root

# Copy source
COPY packages/chess-core ./packages/chess-core
COPY apps/server ./apps/server

# Build chess-core first, then server
RUN npm run build --workspace=packages/chess-core
RUN npm run build --workspace=server

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
