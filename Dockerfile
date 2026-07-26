# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.22
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"

# Build stage
FROM base AS build

# Install node dependencies and build the app
COPY package-lock.json package.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

# Final image
FROM base

# Copy built node app from the build stage
COPY --from=build /app /app

EXPOSE 3000
CMD [ "npm", "run", "start" ]