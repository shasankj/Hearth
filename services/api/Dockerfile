FROM node:24-alpine
WORKDIR /app
COPY services/api/package*.json services/api/
RUN cd services/api && npm ci --omit=dev
COPY services/api services/api
# the API loads the .proto at runtime
COPY proto proto
USER node
WORKDIR /app/services/api
ENV PORT=3000
CMD ["node", "src/server.js"]
