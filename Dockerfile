FROM node:22-alpine
WORKDIR /app
COPY server ./server
COPY lib/groups.ts ./lib/groups.ts
COPY lib/support.ts ./lib/support.ts
COPY privacy.md ./privacy.md
COPY assets/images/tmdb-logo.svg ./assets/images/tmdb-logo.svg
ENV HOST=0.0.0.0
ENV GROUP_FILE=/data/circles.json
EXPOSE 43124
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "const port=process.env.PORT||43124; fetch('http://127.0.0.1:'+port+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "server/index.ts"]
