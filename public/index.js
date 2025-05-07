document.addEventListener('DOMContentLoaded', async () => {
    const orders = document.getElementById('orders');
    
      try {
        const response = await fetch('/api/retrieve_orders');
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
  
        const data = await response.json();
        orders.innerHTML = '';
  
        if (data.length === 0) {
          orders.innerHTML = '<p class="text-muted">No orders found.</p>';
          return;
        }

      // Loop through the response data and display each order
        data.forEach(code => {
          const card = document.createElement('div');
          card.className = 'card shadow-sm mb-4';
  
          const createdAtFormatted = new Date(code.createdAt).toLocaleString();

          card.innerHTML = `
          <div class="card-body">
            <h5 class="card-title mb-2">${code.productName}</h5>
            <p class="card-text mb-1"><strong>URL:</strong> <a href="${code.productUrl}" target="_blank">${code.productUrl}</a></p>
            <p class="card-text mb-1"><strong>Quantity in Stock:</strong> ${code.productQuantity}</p>
            <p class="card-text mb-1"><strong>Order Quantity:</strong> ${code.productOrderQuantity}</p>
            <p class="card-text mb-2"><strong>Description:</strong> ${code.productDescription}</p>
            <div class="d-flex justify-content-between align-items-center">
              <p class="card-text text-muted mb-0"><small>Created On: ${createdAtFormatted}</small></p>
              <button class="btn btn-danger btn-sm" data-id="${code._id}">Delete</button>
            </div>
          </div>
        `;
  
        orders.appendChild(card);
        });

        // Attach button event listeners
        orders.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        console.log('Attempting to delete order with ID:', id);  // Log the ID being deleted
        await handleDelete(id);
      });
    });

    orders.querySelectorAll('.btn-secondary').forEach(btn => {
      btn.addEventListener('click', () => {
        const imgSrc = btn.getAttribute('data-img');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<img src="${imgSrc}" onload="window.print(); window.close();" />`);
        printWindow.document.close();
      });
    });

  } catch (err) {
    orders.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    console.error(err);
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this order?')) return;

    const deleteUrl = `/api/delete_order?id=${id}`;
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