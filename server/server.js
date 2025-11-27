const { server, app } = require("./app");

const PORT = process.env.PORT || 3000;
const path = require('path');

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
