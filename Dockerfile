FROM docker.io/library/node:24.20.0-bookworm-slim AS frontend
WORKDIR /source/web
COPY web/package.json web/package-lock.json ./
RUN npm install --global npm@11.19.0 && npm ci
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0.404 AS backend
WORKDIR /source
COPY global.json Directory.Build.props NuGet.Config ./
COPY src/ src/
COPY tools/Cockpit.Simulator/ tools/Cockpit.Simulator/
COPY --from=frontend /source/src/Cockpit.Web/wwwroot/ src/Cockpit.Web/wwwroot/
RUN dotnet publish src/Cockpit.Web/Cockpit.Web.csproj -c Release \
    --self-contained false -p:RestoreLockedMode=true -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend /publish/ ./
COPY LICENSE COPYRIGHT THIRD-PARTY-NOTICES.md ./
COPY third-party/ third-party/
COPY packaging/container-entrypoint.sh /usr/local/bin/cockpit-entrypoint
RUN mkdir /data && chown app:app /data \
    && chmod 755 /usr/local/bin/cockpit-entrypoint
ENV HOME=/data
USER $APP_UID
EXPOSE 5080
ENTRYPOINT ["/bin/sh", "/usr/local/bin/cockpit-entrypoint"]
