const params = new URLSearchParams(window.location.search);
const orderForm = document.getElementById('orderForm');

document.getElementById('productName').textContent = params.get('product') || 'N/A';
document.getElementById('productQuantity').textContent = params.get('quantity') || 'N/A';
document.getElementById('productDescription').textContent = params.get('description') || 'N/A';
document.getElementById('productLink').textContent = params.get('URL') || 'N/A';



orderForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const productName = document.getElementById('productName').textContent;
  const productQuantity = document.getElementById('productQuantity').textContent;
  const productDescription = document.getElementById('productDescription').textContent;
  const productUrl = params.get('URL'); 
  const productOrderQuantity = document.getElementById('orderQuantity').value;

  if (productUrl) {
    productLink.href = productUrl;
    productLink.textContent = productUrl;
  } else {
    productLink.textContent = 'N/A';
  }

try {
  const response = await fetch("/api/add_order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      productName,
      productQuantity,
      productDescription,
      productUrl,
      productOrderQuantity
    })
  });

  if (!response.ok) {
    throw new Error("Failed to submit order to server");
  }

  const result = await response.json();
  console.log("Order submitted:", result);
  alert("Order submitted successfully!");
} catch (error) {
  console.error("Error submitting order:", error);
  alert("There was a problem submitting your order.");
}
});