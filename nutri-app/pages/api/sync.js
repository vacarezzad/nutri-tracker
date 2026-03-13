export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'POST') {
    // Data comes from Claude artifact, just echo back OK
    // Actual data lives in artifact storage, fetched client-side
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
