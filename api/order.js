export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false
        });
    }

    const {
        service,
        target,
        quantity
    } = req.body;

    const response = await fetch("https://fayupedia.id/api/order", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            api_key: "tz1kcs-eizrjo-bqmt10-13suhv-n7m7zt",
            service,
            target,
            quantity
        })
    });

    const data = await response.json();

    res.status(200).json(data);
}
