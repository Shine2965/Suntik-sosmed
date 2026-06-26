export default async function handler(req, res) {

    const response = await fetch("https://fayupedia.id/api/services", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            api_key: "tz1kcs-eizrjo-bqmt10-13suhv-n7m7zt"
        })
    });

    const data = await response.json();

    res.status(200).json(data);
}
