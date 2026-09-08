# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Stage 2: Runtimeq
# Install bun for runtime
RUN npm install -g bun

# ✅ ADD THIS LINE:
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