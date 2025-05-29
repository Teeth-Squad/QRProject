document.addEventListener('DOMContentLoaded', () => {
  const orders = document.getElementById('orders');
  const searchBar = document.getElementById('searchBar');
  let allOrders = [];

  // Fetch all orders once on page load and on interval
  async function fetchAllOrders() {
    try {
      const response = await fetch('/api/retrieve_orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      allOrders = await response.json();

      // Re-filter and render using current search term
      filterAndRender(searchBar.value.trim());
    } catch (err) {
      orders.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
      console.error(err);
    }
  }

  // Render given order data array
  function renderOrders(data) {
    if (data.length === 0) {
      orders.innerHTML = '<p class="text-muted">No orders found.</p>';
      return;
    }

    let tableHTML = `
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th style="border-right: 1px solid #dee2e6;">Product</th>
            <th style="border-right: 1px solid #dee2e6;">Order URL</th>
            <th style="border-right: 1px solid #dee2e6;">Number of Items</th>
            <th style="border-right: 1px solid #dee2e6;">Order Quantity</th>
            <th style="border-right: 1px solid #dee2e6;">Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(order => {
      const createdAtFormatted = new Date(order.createdAt).toLocaleString();

      tableHTML += `
        <tr>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${order.productName}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;"><a href="${order.productUrl}" target="_blank">${order.productUrl}</a></td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.productQuantity}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${order.productOrderQuantity}</td>
          <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6;">${createdAtFormatted}</td>
          <td class="actions-cell" style="border-right: 1px solid #dee2e6;">
            <button class="btn btn-danger btn-sm delete-btn" data-id="${order._id}">Delete</button>
          </td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table>';
    orders.innerHTML = tableHTML;

    // Attach delete button handlers
    orders.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this order?')) return;

        try {
          const res = await fetch(`/api/delete_order?id=${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');

          // Remove deleted order locally and re-render filtered results
          allOrders = allOrders.filter(order => order._id !== id);
          filterAndRender(searchBar.value.trim());
        } catch (err) {
          alert(`Error deleting order: ${err.message}`);
        }
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
  searchBar.addEventListener('input', () => {
    filterAndRender(searchBar.value.trim());
  });

  // Add 5-second interval to refresh orders from server
  setInterval(fetchAllOrders, 15000);
});