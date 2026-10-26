FROM node:22-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies required for build and runtime
RUN npm ci || npm install

# Copy source code and assets
COPY . .

# Build client production bundle
RUN npm run build

# Default environment
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Start VANTÉRA engine
CMD ["npm", "start"]
