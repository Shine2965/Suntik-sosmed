app.get("/credentials", (req, res) => {
  const credentials = {
    username: Buffer.from(process.env.ADMIN_USERNAME).toString("base64"),
    password: Buffer.from(process.env.ADMIN_PASSWORD).toString("base64"),
    saldo: Buffer.from(process.env.ADMIN_SALDO).toString("base64")
  };

  res.json(credentials);
});
