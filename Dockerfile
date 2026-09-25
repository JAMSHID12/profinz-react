# Build context: frontend/ for Railway and local Docker Compose.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Reject missing, placeholder or malformed URLs before shipping a broken frontend.
RUN node -e "const v=process.env.VITE_API_BASE_URL; const u=new URL(v); if(!['http:','https:'].includes(u.protocol)||u.pathname!='/api'||u.search||u.hash||u.username||u.password||u.hostname.includes('your-')||u.hostname.includes('replace_with')||u.hostname.endsWith('.invalid')) throw Error('Set VITE_API_BASE_URL to the public backend URL ending in /api');" \
    && npm run build

FROM nginx:stable-alpine
ENV PORT=80
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
