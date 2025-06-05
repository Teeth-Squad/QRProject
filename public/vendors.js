document.addEventListener('DOMContentLoaded', () => {
  const vendorList = document.getElementById('vendorList');
  const vendorForm = document.getElementById('vendorForm');
  const searchInput = document.getElementById('searchInput');
  const modalElement = document.getElementById('addVendorModal');

  modalElement.addEventListener("hide.bs.modal", () => {
    const focused = modalElement.querySelector(":focus");
    if (focused) focused.blur();

    vendorForm.reset();
  });

  let allVendors = [];

  // Fetch all vendors
  async function fetchAllVendors() {
    try {
      const response = await fetch('/api/retrieve_vendors');
      if (!response.ok) throw new Error('Failed to fetch vendors');
      allVendors = await response.json();

      const currentSearch = searchInput.value.trim();
      filterAndRender(currentSearch);
    } catch (err) {
      vendorList.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
      console.error(err);
    }
  }

  function filterAndRender(searchTerm) {
    const filtered = allVendors.filter(vendor =>
      vendor.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.vendorEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );
    renderVendors(filtered);
  }

  function renderVendors(vendors) {
    if (!vendors.length) {
      vendorList.innerHTML = `<p class="text-muted">No vendors found.</p>`;
      return;
    }

    let tableHTML = `
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th style="text-align: center;"><input type="checkbox" id="selectAll"></th>
            <th style="text-align: center;">Name</th>
            <th style="text-align: center;">Email</th>
          </tr>
        </thead>
        <tbody>
    `;

    vendors.forEach(vendor => {
      tableHTML += `
        <tr id="qrCard-${vendor._id}">
          <td style="vertical-align: middle; text-align: center;">
            <input type="checkbox" class="row-checkbox" data-id="${vendor._id}">
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${vendor.vendorName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${vendor.vendorEmail}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    vendorList.innerHTML = tableHTML;

    // Add checkbox select all behavior
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      vendorList.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }

  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

deleteSelectedBtn.addEventListener('click', async () => {
  const checkboxes = document.querySelectorAll('.row-checkbox:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);

  if (selectedIds.length === 0) {
    alert('No vendors selected.');
    return;
  }

  const confirmed = confirm(`Delete ${selectedIds.length} vendor(s)?`);
  if (!confirmed) return;

  try {
    const response = await fetch('/api/delete_vendors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: selectedIds })
    });

    if (response.ok) {
      selectedIds.forEach(id => {
        const row = document.getElementById(`vendorRow-${id}`);
        if (row) row.remove();
      });
    } else {
      alert('Failed to delete vendors.');
    }
  } catch (err) {
    console.error(err);
    alert('An error occurred while deleting vendors.');
  }
});


  // Handle form submission
  vendorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('vendorName').value.trim();
    const email = document.getElementById('vendorEmail').value.trim();

    try {
      const res = await fetch('/api/add_vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorName: name, vendorEmail: email })
      });

      if (!res.ok) throw new Error('Failed to add vendor');

      vendorForm.reset();

      const modal = bootstrap.Modal.getInstance(document.getElementById('addVendorModal'));
      modal.hide();
      
      fetchAllVendors();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });

  // Search input listener
  searchInput.addEventListener('input', () => {
    filterAndRender(searchInput.value.trim());
  });

  // Initial fetch
  fetchAllVendors();

  // Auto-refresh every 15 seconds
  setInterval(fetchAllVendors, 1500000);
});