# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install bun
RUN npm install -g bun

# ARG for Supabase
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Copy dependency files
COPY package.json bun.lock ./

# Install all dependencies (dev + production)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Stage 2: Runtime
FROM node:24-alpine

WORKDIR /app

# Install bun for runtime
RUN npm install -g bun

# ✅ SET PORT
ENV PORT=3000

# Copy package files for production install
COPY --from=builder /app/package.json ./

# Copy the compiled output
COPY --from=builder /app/.output ./.output

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Expose port
EXPOSE 3000

# Start the application
CMD ["bunx", "srvx", "--prod", "-s", ".output/public", ".output/server/index.mjs"]