# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install bun
RUN npm install -g bun

# ✅ ADD THESE LINES:
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