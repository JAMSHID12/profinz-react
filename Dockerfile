# Build context is the repository root so the shared nginx config can be copied.
# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Nothing client-specific is baked in: name, logo, colours and currency are loaded
# from GET /api/config/public when the app starts.
RUN npm run build

# ---- Runtime stage --------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 80
