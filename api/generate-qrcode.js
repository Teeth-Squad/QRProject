import QRCode from 'qrcode';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { productName, productUrl } = req.body;

    if (!productName || !productUrl) {
      return res.status(400).send('Missing product name or URL');
    }

    console.log(`Generating QR for: ${productName}, ${productUrl}`);

    const qrData = `URL: ${productUrl}`;
    const qrBuffer = await QRCode.toBuffer(qrData);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="product_qr_code.png"');
    return res.status(200).send(qrBuffer);
  } catch (err) {
    console.error("QR Generation Error:", err);
    return res.status(500).send('Error generating QR code');
  }
}