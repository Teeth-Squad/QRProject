document.addEventListener('DOMContentLoaded', () => {
  const orders = document.getElementById('orders');
  const orderForm = document.getElementById('orderForm');
  const modalElement = document.getElementById('addOrderModal');
  const qrDropdown = document.getElementById('qrDropdown');
  const orderQuantityInput = document.getElementById('orderQuantity');

  modalElement.addEventListener("hide.bs.modal", () => {
    const focused = modalElement.querySelector(":focus");
    if (focused) focused.blur();
    orderForm.reset();
  });

  let allOrders = [];
  let qrCodes = [];

  async function fetchAllOrders() {
    try {
      const response = await fetch('/api/retrieve_active_orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      allOrders = await response.json();
      const currentSearch = searchInput.value.trim();
      filterAndRender(currentSearch);
    } catch (err) {
      orders.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
      console.error(err);
    }
  }

  function renderOrders(data) {
    if (!data.length) {
      orders.innerHTML = '<p class="text-muted">No orders found.</p>';
      return;
    }

    let tableHTML = `
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th style="text-align: center;"><input type="checkbox" id="selectAll"></th>
            <th style="text-align: center;">Product</th>
            <th style="text-align: center;">Order URL</th>
            <th style="text-align: center;">Number of Items</th>
            <th style="text-align: center;">Order Quantity</th>
            <th style="text-align: center;">Vendor</th>
            <th style="text-align: center;">Created At</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(order => {
      const createdAtFormatted = new Date(order.createdAt).toLocaleString();
      tableHTML += `
        <tr id="qrCard-${order._id}">
          <td style="vertical-align: middle; text-align: center; border-left: 1px solid #dee2e6;">
            <input type="checkbox" class="row-checkbox" data-id="${order._id}">
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${order.productName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;"><a href="${order.productURL}" target="_blank">${order.productURL}</a></td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.productQuantity}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.productOrderQuantity}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.vendorName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${createdAtFormatted}</td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table>';
    orders.innerHTML = tableHTML;

    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      orders.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }

  function filterAndRender(searchTerm) {
    const filtered = allOrders.filter(order =>
      order.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    renderOrders(filtered);
  }

  async function fetchQrCodes() {
    try {
      const res = await fetch('/api/retrieve_qrs');
      qrCodes = await res.json();

      qrDropdown.innerHTML = qrCodes.map(qr =>
        `<option value='${JSON.stringify(qr)}'>${qr.productName}</option>`
      ).join('');
    } catch (err) {
      console.error('Failed to fetch QR codes:', err);
    }
  }

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = orderForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const selectedQr = JSON.parse(qrDropdown.value);
      const productOrderQuantity = parseInt(orderQuantityInput.value);

      if (!selectedQr || !productOrderQuantity || isNaN(productOrderQuantity) || productOrderQuantity <= 0) {
        alert('Please fill in all fields with valid values.');
        submitBtn.disabled = false;
        return;
      }

      const payload = {
        productName: selectedQr.productName,
        productQuantity: selectedQr.productQuantity,
        productURL: selectedQr.productURL,
        productOrderQuantity
      };

      const res = await fetch('/api/add_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to add order');

      await fetchAllOrders();
      bootstrap.Modal.getInstance(modalElement).hide();
    } catch (err) {
      alert(`Error adding order: ${err.message}`);
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  fetchAllOrders();
  fetchQrCodes();

  searchInput.addEventListener('input', () => {
    filterAndRender(searchInput.value.trim());
  });

  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

  deleteSelectedBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    if (!checkboxes.length) {
      alert('No orders selected for deletion.');
      return;
    }

    const confirmDelete = confirm(`Delete ${checkboxes.length} selected order(s)?`);
    if (!confirmDelete) return;

    for (const checkbox of checkboxes) {
      const id = checkbox.getAttribute('data-id');
      try {
        const response = await fetch(`/api/delete_orders?id=${id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Error deleting order ${id}:`, errorData.error);
        }
      } catch (err) {
        console.error(`Failed to delete order ${id}:`, err);
      }
    }})

  const completeSelectedBtn = document.getElementById('completeSelectedBtn');

  completeSelectedBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    if (!checkboxes.length) {
      alert('No orders selected for completion.');
      return;
    }

    const confirmComplete = confirm(`Complete ${checkboxes.length} selected order(s)?`);
    if (!confirmComplete) return;

    for (const checkbox of checkboxes) {
      const id = checkbox.getAttribute('data-id');
      try {
        const response = await fetch(`/api/complete_orders?id=${id}`, {method: 'PATCH' });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Error updating order ${id}:`, errorData.error);
        }
      } catch (err) {
        console.error(`Failed to update the order ${id}:`, err);
      }
    }

    await fetchAllOrders();
  });

  setInterval(fetchAllOrders, 15000);
});