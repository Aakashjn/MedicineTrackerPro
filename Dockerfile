# Multi-stage build for frontend and backend
FROM node:18-alpine as backend

# Backend setup
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# If you have a frontend, uncomment and modify this section:
# FROM node:18-alpine as frontend
# WORKDIR /app/frontend  
# COPY frontend/package*.json ./
# RUN npm install
# COPY frontend/ ./
# RUN npm run build

# Final stage
FROM node:18-alpine
WORKDIR /app

# Copy backend
COPY --from=backend /app/backend ./

# If you have frontend build, uncomment:
# COPY --from=frontend /app/frontend/build ./public

EXPOSE 3000
CMD ["node", "server.js"]
