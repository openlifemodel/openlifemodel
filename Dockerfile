# Self-host the OpenLifeModel calculator: a static site served by nginx.
#   docker build -t openlifemodel .
#   docker run --rm -p 8080:8080 openlifemodel
# then open http://localhost:8080

FROM node:24-alpine AS build
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY engine/package.json engine/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile
COPY spec spec
COPY engine engine
COPY models models
COPY web web
RUN pnpm --filter @openlifemodel/web build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/out /usr/share/nginx/html
EXPOSE 8080
