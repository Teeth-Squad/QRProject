const params = new URLSearchParams(window.location.search);
const productName = params.get('productName');
const productUrl = params.get('productUrl');

if (productName && productUrl) {
  document.getElementById('title').textContent = `Order: ${productName}`;
  document.getElementById('link').innerHTML = `<a href="${productUrl}" target="_blank">${productUrl}</a>`;
}

document.getElementById('orderForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const quantity = document.getElementById('quantity').value;

  const res = await fetch('/api/add_order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        productName,
        productUrl,
        orderQuantity: parseInt(quantity, 10)
      })
  });

  if (res.ok) {
    document.getElementById('status').textContent = '✅ Order submitted successfully!';
  } else {
    document.getElementById('status').textContent = '❌ Failed to submit order.';
  }
});
