document.addEventListener('DOMContentLoaded', () => {
  const qrCodes = document.getElementById('qrCodes');
  const searchInput = document.getElementById('searchInput');
  const qrForm = document.getElementById('QRCodeForm');
  const modalElement = document.getElementById('addQRCodeModal');
  const vendorSelect = document.getElementById('vendorSelect');
  let allCodes = [];

  modalElement.addEventListener("hide.bs.modal", () => {
    const focused = modalElement.querySelector(":focus");
    if (focused) focused.blur();
    qrForm.reset();
  });

  async function fetchVendors() {
    try {
      const res = await fetch('/api/retrieve_vendors');
      if (!res.ok) throw new Error('Failed to fetch vendors');
      const vendors = await res.json();

      vendorSelect.innerHTML = '<option value="N/A">N/A</option>';
      vendors.forEach(vendor => {
        const option = document.createElement('option');
        option.value = vendor._id;
        option.textContent = vendor.vendorName;
        vendorSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Vendor fetch error:', err);
      vendorSelect.innerHTML = '<option disabled>Error loading vendors</option>';
    }
  }

  async function fetchAllCodes() {
    try {
      const response = await fetch('/api/retrieve_qrs');
      if (!response.ok) throw new Error('Failed to fetch QR codes');
      allCodes = await response.json();
      filterAndRender(searchInput.value.trim());
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
            <th style="text-align: center;"><input type="checkbox" id="selectAll"></th>
            <th style="text-align: center;">QR Code</th>
            <th style="text-align: center;">Name</th>
            <th style="text-align: center;">URL</th>
            <th style="text-align: center;">Vendor</th>
            <th style="text-align: center;">Create Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(code => {
      const createdAtFormatted = new Date(code.createdAt).toLocaleString();
      tableHTML += `
        <tr id="qrCard-${code._id}">
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">
            <input type="checkbox" class="row-checkbox" data-id="${code._id}">
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">
            <img id="qrImg-${code._id}" src="${code.qrCodeDataURL}" alt="QR Code" width="80" class="img-fluid rounded border">
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${code.productName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">
            <a href="${code.productURL}" target="_blank">${code.productURL}</a>
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${code.vendorName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${createdAtFormatted}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    qrCodes.innerHTML = tableHTML;

    // Add checkbox select all behavior
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      qrCodes.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }

  document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
  const selectedCheckboxes = qrCodes.querySelectorAll('.row-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    alert('No QR codes selected.');
    return;
  }

  if (!confirm(`Delete ${selectedCheckboxes.length} selected QR code(s)?`)) return;

  const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));

  try {
    for (const id of idsToDelete) {
      const res = await fetch(`/api/delete_qrs?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete item with id ${id}`);
    }

    allCodes = allCodes.filter(code => !idsToDelete.includes(code._id));
    filterAndRender(searchInput.value.trim());
  } catch (err) {
    alert(`Error deleting selected QR codes: ${err.message}`);
  }
});

function printSelectedQRCodes() {
  // Select all checked row checkboxes
  const checkedBoxes = document.querySelectorAll('#qrCodes .row-checkbox:checked');

  if (checkedBoxes.length === 0) {
    alert('Please select at least one QR code to print.');
    return;
  }

  // Build HTML content for printing
  let printContent = `
    <html>
    <head>
      <title>Print QR Codes</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        .qr-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          justify-content: flex-start;
        }
        .qr-item {
          border: 1px solid #ddd;
          padding: 10px;
          width: 200px;
          text-align: center;
          page-break-inside: avoid;
        }
        .qr-item img {
          max-width: 150px;
          height: auto;
          margin-bottom: 10px;
        }
        .qr-item .name {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .qr-item .vendor {
          color: #555;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <h1>Selected QR Codes</h1>
      <div class="qr-grid">
  `;

  checkedBoxes.forEach(checkbox => {
    const tr = checkbox.closest('tr');
    if (!tr) return;

    const img = tr.querySelector('img');
    const name = tr.cells[2]?.textContent || ''; // productName cell
    const vendor = tr.cells[4]?.textContent || ''; // vendorName cell

    printContent += `
      <div class="qr-item">
        <img src="${img?.src || ''}" alt="QR code for ${name}" />
        <div class="name">${name}</div>
        <div class="vendor">${vendor}</div>
      </div>
    `;
  });

  printContent += `
      </div>
    </body>
    </html>
  `;

  // Open a new window and write the content
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(printContent);
  printWindow.document.close();

  printWindow.onload = function () {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
}

document.getElementById('printSelectedBtn').addEventListener('click', printSelectedQRCodes);

  qrForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const submitBtn = qrForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const productName = document.getElementById('productName').value.trim();
      const productQuantity = document.getElementById('productQuantity').value.trim();
      const productURL = document.getElementById('productURL').value.trim();
      const vendorId = vendorSelect.value;

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
          submitBtn.disabled = false;
          return;
        }

        try {
          const res = await fetch('/api/add_qrs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productName,
              productQuantity,
              productURL,
              vendorId,
              qrCodeDataURL
            })
          });

          if (!res.ok) throw new Error('Failed to add QR Code');

          qrForm.reset();
          const modal = bootstrap.Modal.getInstance(modalElement);
          modal.hide();
          await fetchAllCodes();
        } catch (err) {
          alert(`Error: ${err.message}`);
        }

        submitBtn.disabled = false;
      });
    } catch (err) {
      console.error("Submission error:", err);
      alert("Something went wrong. Please try again.");
      submitBtn.disabled = false;
    }
  });

  searchInput.addEventListener('input', () => {
    filterAndRender(searchInput.value.trim());
  });

  fetchAllCodes();
  fetchVendors();
  setInterval(fetchAllCodes, 1500000);
});