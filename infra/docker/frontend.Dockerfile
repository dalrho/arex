FROM node:20-alpine

# Set working directory to /app
WORKDIR /app

# Copy dependency definition manifest
COPY frontend/package.json ./

# Install npm dependencies
RUN npm install

# Copy application code
COPY frontend ./

# Build Next.js static files (unblocks production mode build checks)
RUN npm run build

# Expose port for Next.js web application
EXPOSE 3000

# Default command for Next.js dev container execution
CMD ["npm", "run", "dev"]
