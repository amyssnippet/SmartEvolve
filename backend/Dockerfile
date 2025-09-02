FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p storage/open-source/models \
    storage/open-source/datasets \
    storage/users \
    uploads/temp \
    logs

# Set permissions
RUN chown -R node:node /app
USER node

EXPOSE 8000

CMD ["npm", "run", "dev"]
