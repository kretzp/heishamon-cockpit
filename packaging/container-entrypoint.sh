#!/bin/sh
set -eu
# Keep installation settings, certificates, databases and keys on one volume.
if [ ! -f /data/appsettings.json ]; then
    cp /app/appsettings.json /data/appsettings.json
fi
exec dotnet /app/Cockpit.Web.dll --contentRoot /data --webroot /app/wwwroot "$@"
