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
            <th style="text-align: center; border-right: 1px solid #dee2e6;">Name</th>
            <th style="text-align: center; border-right: 1px solid #dee2e6;">Email</th>
            <th style="text-align: center;">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    vendors.forEach(vendor => {
      tableHTML += `
        <tr>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${vendor.vendorName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${vendor.vendorEmail}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">
            <button class="btn btn-danger btn-sm delete-btn" data-id="${vendor._id}">Delete</button>
          </td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    vendorList.innerHTML = tableHTML;

    // Attach delete handlers
    vendorList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this vendor?')) return;

        try {
          const res = await fetch(`/api/delete_vendor?id=${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');

          allVendors = allVendors.filter(v => v._id !== id);
          filterAndRender(searchInput.value.trim());
        } catch (err) {
          alert(`Error deleting vendor: ${err.message}`);
        }
      });
    });
  }

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
  setInterval(fetchAllVendors, 15000);
});