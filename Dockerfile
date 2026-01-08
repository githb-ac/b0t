FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./
COPY drizzle.config.ts ./

# Install dependencies with legacy peer deps to resolve conflicts
RUN npm install --legacy-peer-deps --production=false

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", ".next/standalone/server.js"]
