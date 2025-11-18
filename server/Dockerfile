# Use Node.js official image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production --force

# Copy the rest of the project
COPY . .

# Build TypeScript code
RUN npm run build

# Run all workers concurrently in production
CMD ["npx", "concurrently", "-n", "SMS,EMAIL,WHATSAPP", "-c", "blue,green,magenta", "npm run start:sms-worker:prod", "npm run start:email-worker:prod", "npm run start:whatsapp-worker:prod"]
