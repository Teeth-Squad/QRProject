document.addEventListener('DOMContentLoaded', () => {
  const orders = document.getElementById('orders');
  const orderForm = document.getElementById('orderForm');
  const searchBar = document.getElementById('searchBar');
  const modalElement = document.getElementById('addOrderModal');

  modalElement.addEventListener("hide.bs.modal", () => {
    const focused = modalElement.querySelector(":focus");
    if (focused) focused.blur();

    orderForm.reset();

  });

  let allOrders = [];

  // Fetch all orders once on page load and on interval
  async function fetchAllOrders() {
    try {
      const response = await fetch('/api/retrieve_orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      allOrders = await response.json();

      const currentSearch = searchInput.value.trim();
      filterAndRender(currentSearch);
    } catch (err) {
      orders.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
      console.error(err);
    }
  }

  // Render given order data array
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
            <th style="text-align: center;">Created At</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(order => {
      const createdAtFormatted = new Date(order.createdAt).toLocaleString();

      tableHTML += `
        <tr id="qrCard-${data._id}">
          <td style="vertical-align: middle; text-align: center;">
            <input type="checkbox" class="row-checkbox" data-id="${data._id}">
          </td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${order.productName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;"><a href="${order.productUrl}" target="_blank">${order.productUrl}</a></td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.productQuantity}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.productOrderQuantity}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${createdAtFormatted}</td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table>';
    orders.innerHTML = tableHTML;

    // Add checkbox select all behavior
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      orders.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }

  // Filter local data by search term and render
  function filterAndRender(searchTerm) {
    const filtered = allOrders.filter(order =>
      order.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    renderOrders(filtered);
  }

  // Initial fetch of all orders on page load
  fetchAllOrders();

  // Live filtering on input without debounce
  searchInput.addEventListener('input', () => {
    filterAndRender(searchInput.value.trim());
  });

  // Add 5-second interval to refresh orders from server
  setInterval(fetchAllOrders, 15000);
});