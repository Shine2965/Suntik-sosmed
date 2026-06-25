export default async function handler(req, res) {
  try {
    const data = JSON.parse(
      process.env.SOSMED_2_DATA || "{}"
    );

    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
}
