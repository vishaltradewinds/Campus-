FROM node:22.22.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.22.0-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/firebase-applet-config.json ./firebase-applet-config.json
EXPOSE 8080
USER node
CMD ["node", "dist/server.cjs"]
