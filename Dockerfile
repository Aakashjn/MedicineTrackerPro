# Backend build stage
FROM node:18-alpine as backend

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# Final stage
FROM node:18-alpine
WORKDIR /app

# Copy backend code from build stage
COPY --from=backend /app/backend ./

# Copy frontend static files into /app/public
COPY frontend/ ./public/

EXPOSE 4000
CMD ["node", "server.js"]
