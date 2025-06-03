document.addEventListener('DOMContentLoaded', () => {
  const qrCodes = document.getElementById('qrCodes');
  const searchInput = document.getElementById('searchInput');
  const qrForm = document.getElementById('QRCodeForm');
  const modalElement = document.getElementById('addQRCodeModal');
  let allCodes = [];

  modalElement.addEventListener("hide.bs.modal", () => {
    const focused = modalElement.querySelector(":focus");
    if (focused) focused.blur();

    qrForm.reset();
  });

  async function fetchAllCodes() {
    try {
      const response = await fetch('/api/retrieve_qr');
      if (!response.ok) throw new Error('Failed to fetch QR codes');
      allCodes = await response.json();

      const currentSearch = searchInput.value.trim();
      filterAndRender(currentSearch);
    } catch (err) {
      qrCodes.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
      console.error(err);
    }
  }

  function filterAndRender(searchTerm) {
    const filtered = allCodes.filter(code =>
      code.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    renderCodes(filtered);
  }

  function renderCodes(data) {
    if (!data.length) {
      qrCodes.innerHTML = `<p class="text-muted">No QR codes found.</p>`;
      return;
    }

    let tableHTML = `
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th style="text-align: center; border-right: 1px solid #dee2e6;">QR Code</th>
            <th style="text-align: center; border-right: 1px solid #dee2e6;">Name</th>
            <th style="text-align: center; border-right: 1px solid #dee2e6;">URL</th>
            <th style="text-align: center; border-right: 1px solid #dee2e6;">Create Date</th>
            <th style="text-align: center;">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(code => {
      const createdAtFormatted = new Date(code.createdAt).toLocaleString();

      tableHTML += `
        <tr>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;"><img src="${code.qrCodeDataURL}" alt="QR Code" width="80" class="img-fluid rounded border"></td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${code.productName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;"><a href="${code.productURL}" target="_blank">${code.productURL}</a></td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${createdAtFormatted}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">
            <button class="btn btn-danger btn-sm delete-btn" data-id="${code._id}">Delete</button>
          </td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    qrCodes.innerHTML = tableHTML;

    qrCodes.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this QR code?')) return;

        try {
          const res = await fetch(`/api/delete_qr?id=${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');

          allCodes = allCodes.filter(code => code._id !== id);
          filterAndRender(searchInput.value.trim());
        } catch (err) {
          alert(`Error deleting QR code: ${err.message}`);
        }
      });
    });
  }

  qrForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const productName = document.getElementById('productName').value.trim();
    const productQuantity = document.getElementById('productQuantity').value.trim();
    const productURL = document.getElementById('productURL').value.trim();

    const baseUrl = window.location.origin + "/mobile_order.html";
    const params = new URLSearchParams({
      product: productName,
      quantity: productQuantity,
      URL: productURL
    });

    const qrData = `${baseUrl}?${params.toString()}`;

    QRCode.toDataURL(qrData, { width: 150, height: 150 }, async function (err, qrCodeDataURL) {
      if (err) {
        console.error("Error generating QR code:", err);
        return;
      }

      try {
        const res = await fetch('/api/add_qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName,
            productQuantity,
            productURL,
            qrCodeDataURL
          })
        });

        if (!res.ok) throw new Error('Failed to add QR Code');

        qrForm.reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addQRCodeModal'));
        modal.hide();

        fetchAllCodes();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  });

  searchInput.addEventListener('input', () => {
    filterAndRender(searchInput.value.trim());
  });

  fetchAllCodes();
  setInterval(fetchAllCodes, 15000);
});