FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json game.js server.js ./
COPY public ./public
ENV NODE_ENV=production DATA_DIR=/app/data PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
