const params = new URLSearchParams(window.location.search);
const orderForm = document.getElementById('orderForm');

const productNameElem = document.getElementById('productName');
const productQuantityElem = document.getElementById('productQuantity');
const productLink = document.getElementById('productLink');

productNameElem.textContent = params.get('product') || 'N/A';
productQuantityElem.textContent = params.get('quantity') || 'N/A';
productLink.textContent = params.get('URL') || 'N/A';

const productUrl = params.get('URL');
if (productUrl) {
  productLink.href = productUrl;
  productLink.textContent = productUrl;
} else {
  productLink.textContent = 'N/A';
}

orderForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const productName = productNameElem.textContent;
  const productQuantity = productQuantityElem.textContent;
  const productOrderQuantity = document.getElementById('orderQuantity').value;

  try {
    const response = await fetch("/api/add_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productName,
        productQuantity,
        productUrl,
        productOrderQuantity
      })
    });

    if (!response.ok) {
      throw new Error("Failed to submit order to server");
    }

    const result = await response.json();
    console.log("Order submitted:", result);

    window.location.href = "/order_end_screen.html";

  } catch (error) {
    console.error("Error submitting order:", error);
    alert("There was a problem submitting your order.");
  }
});