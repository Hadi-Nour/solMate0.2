const dotenv = require("dotenv");
const parsed = dotenv.config({ path: "/var/www/playsolmates/.env" }).parsed || {};

module.exports = {
  apps: [
    {
      name: "playsolmates",
      cwd: "/var/www/playsolmates",
      script: "/usr/bin/node",
      args: "server.mjs",
      env: {
        ...parsed,
        NODE_ENV: "production",
        PORT: parsed.PORT || "3000",
      },
    },
  ],
};
