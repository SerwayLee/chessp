const { server, app } = require("./app");

const PORT = process.env.PORT || 4000;

app.get("/", (_req, res) => res.send("Chess server running"));

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
