# Home Assistant build: only the Supervisor Ingress proxy may connect.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8099 DATA_DIR=/data INGRESS_ONLY=true
COPY package.json ./
COPY src ./src
COPY public ./public
EXPOSE 8099
CMD ["node", "src/server.js"]
