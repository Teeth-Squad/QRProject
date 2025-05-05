document.addEventListener('DOMContentLoaded', () => {
  const fetchBtn = document.getElementById('fetchBtn');
  const searchInput = document.getElementById('searchProduct');
  const qrResults = document.getElementById('qrResults');

  fetchBtn.addEventListener('click', async () => {
    const productName = searchInput.value.trim();
    let url = '/api/retrieve_qr';
    if (productName) {
      url += `?productName=${encodeURIComponent(productName)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch QR codes');
      }

      const data = await response.json();
      qrResults.innerHTML = '';

      data.forEach(code => {
        const card = document.createElement('div');
        const createdAtFormatted = new Date(code.createdAt).toLocaleString();  // Format date
        

        card.innerHTML = `
          <strong>${code.productName}</strong><br>
          <a href="${code.productUrl}" target="_blank">${code.productUrl}</a><br>
          <img src="${code.qrCodeDataUrl}" width="150"><br>
          <small>Created On: ${createdAtFormatted}</small>
          <hr>
        `;

        qrResults.appendChild(card);
      });
    } catch (err) {
      qrResults.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
      console.error(err);
    }
  });
});