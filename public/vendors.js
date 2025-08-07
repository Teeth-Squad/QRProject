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

  function formatCadence(cadence) {
  if (!cadence || !cadence.type) return 'N/A';

  switch (cadence.type) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      if (!cadence.days?.length) return 'Weekly (unspecified)';
      return `Weekly on ${cadence.days.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ')}`;
    case 'every_x_weeks':
      return `Every ${cadence.interval} week(s) on ${capitalize(cadence.day)}`;
    case 'monthly':
      return `Monthly on day ${cadence.day}`;
    default:
      return 'Unknown cadence';
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
            <th style="text-align: center;">Cadence</th>
          </tr>
        </thead>
        <tbody>
    `;

    vendors.forEach(vendor => {
      const cadenceDescription = formatCadence(vendor.cadence);

      tableHTML += `
        <tr id="qrCard-${vendor._id}">
          <td style="vertical-align: middle; text-align: center; border-left: 1px solid #dee2e6;">
            <input type="checkbox" class="row-checkbox" data-id="${vendor._id}">
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${vendor.vendorName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${vendor.vendorEmail}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${cadenceDescription}</td>
          </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    vendorList.innerHTML = tableHTML;

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

  vendorForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const vendorName = document.getElementById('vendorName').value.trim();
      const vendorEmail = document.getElementById('vendorEmail').value.trim();
      const cadenceType = document.getElementById('cadenceType').value;

      let cadence = { type: cadenceType };

      if (!vendorName || !vendorEmail) {
        throw new Error("Vendor name and email are required.");
      }

      if (cadenceType === 'weekly') {
        const checked = Array.from(document.querySelectorAll('input[name="weeklyDays"]:checked'));
        if (checked.length === 0) throw new Error('Please select at least one weekday.');
        cadence.days = checked.map(cb => cb.value);
      }

      if (cadenceType === 'every_x_weeks') {
        const interval = parseInt(document.getElementById('everyX').value);
        const day = document.getElementById('everyXDay').value;
        if (!interval || interval < 1) throw new Error('Interval must be a positive number.');
        if (!day) throw new Error('Please select a weekday.');
        cadence.interval = interval;
        cadence.day = day;
      }

      if (cadenceType === 'monthly') {
        const monthlyDay = parseInt(document.getElementById('monthlyDay').value);
        if (!monthlyDay || monthlyDay < 1 || monthlyDay > 31) {
          throw new Error('Please enter a valid day of the month (1–31).');
        }
        cadence.day = monthlyDay;
      }

      console.log("Submitting vendor with cadence:", cadence);

      const response = await fetch('/api/add_vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorName, vendorEmail, cadence })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      alert("Vendor added successfully!");
      vendorForm.reset();

    } catch (err) {
      alert(`Failed to add vendor: ${err.message}`);
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('cadenceType').addEventListener('change', (e) => {
    const type = e.target.value;
    document.getElementById('weeklyDaysContainer').style.display = (type === 'weekly') ? 'block' : 'none';
    document.getElementById('everyXWeeksContainer').style.display = (type === 'every_x_weeks') ? 'block' : 'none';
    document.getElementById('monthlyContainer').style.display = (type === 'monthly') ? 'block' : 'none';
  });

  searchInput.addEventListener('input', () => {
    filterAndRender(searchInput.value.trim());
  });

  fetchAllVendors();
  setInterval(fetchAllVendors, 15000);
});
