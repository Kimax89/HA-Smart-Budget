# Home Assistant build: only the Supervisor Ingress proxy may connect.
FROM node:24.22.3-alpine3.24
RUN apk add --no-cache su-exec
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8099 DATA_DIR=/data INGRESS_ONLY=true
COPY package.json ./
COPY src ./src
COPY public ./public
COPY --chmod=755 container-entrypoint.sh /usr/local/bin/budget-entrypoint
ENTRYPOINT ["budget-entrypoint"]
EXPOSE 8099
CMD ["node", "src/server.js"]
