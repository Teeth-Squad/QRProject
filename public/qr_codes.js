document.addEventListener('DOMContentLoaded', async () => {
  const qrCodes = document.getElementById('qrCodes');
  
  try {
    const response = await fetch('/api/retrieve_qr');
    if (!response.ok) {
      throw new Error('Failed to fetch QR codes');
    }

    const data = await response.json();
    qrCodes.innerHTML = '';

    if (data.length === 0) {
      qrCodes.innerHTML = `<p class="text-muted">No QR codes found.</p>`;
      return;
    }

    // Loop through the response data and display each QR code
    data.forEach(code => {
      const card = document.createElement('div');
      card.className = 'card shadow-sm mb-4';

      const createdAtFormatted = new Date(code.createdAt).toLocaleString();

      card.innerHTML = ` 
      <div class="d-flex align-items-start gap-4 p-3">
        <div>
          <img src="${code.qrCodeDataUrl}" alt="QR Code" width="150" class="img-fluid rounded border">
        </div>
        <div class="flex-grow-1 d-flex flex-column justify-content-between">
          <div class="pb-2">
            <h5 class="mb-2">${code.productName}</h5>
            <p class="mb-1"><a href="${code.productUrl}" target="_blank">${code.productUrl}</a></p>
          </div>
          <div class="d-flex justify-content-between align-items-end mt-3">
            <p class="text-muted mb-0 align-self-center"><small>Created On: ${createdAtFormatted}</small></p>
            <div class="d-flex gap-2">
              <button class="btn btn-secondary" data-img="${code.qrCodeDataUrl}">Print</button>
              <button class="btn btn-danger" data-id="${code._id}">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;

      qrCodes.appendChild(card);
    });

    // Attach button event listeners
    qrCodes.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        console.log('Attempting to delete QR code with ID:', id);  // Log the ID being deleted
        await handleDelete(id);
      });
    });

    qrCodes.querySelectorAll('.btn-secondary').forEach(btn => {
      btn.addEventListener('click', () => {
        const imgSrc = btn.getAttribute('data-img');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<img src="${imgSrc}" onload="window.print(); window.close();" />`);
        printWindow.document.close();
      });
    });

  } catch (err) {
    qrCodes.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    console.error(err);
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this QR code?')) return;

    const deleteUrl = `/api/delete_qr?id=${id}`;
    console.log('Sending delete request to:', deleteUrl);  // Log the URL before sending the delete request

    try {
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      location.reload(); // Refresh list after deletion
    } catch (err) {
      alert(`Error deleting QR code: ${err.message}`);
    }
  }
});