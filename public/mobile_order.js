const params = new URLSearchParams(window.location.search);
const orderForm = document.getElementById('orderForm');

const productNameElem = document.getElementById('productName');
const productQuantityElem = document.getElementById('productQuantity');
const productLink = document.getElementById('productLink');

let productData = null;

// Function to fetch product data using UID
async function fetchProductByUID(uid) {
    try {
        const response = await fetch(`/api/retrieve_qrs?uid=${encodeURIComponent(uid)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch product data');
        }

        const data = await response.json();

        // If you expect a single object instead of an array:
        return data[0]; // Assuming backend returns an array with one matching result
    } catch (error) {
        console.error('Error fetching product data:', error);
        throw error;
    }
}

// Function to display product information
function displayProductInfo(data) {
    productNameElem.textContent = data.productName || 'N/A';
    productQuantityElem.textContent = data.productQuantity || 'N/A';
    
    if (data.productURL) {
        productLink.href = data.productURL;
        productLink.textContent = 'Product Order Page';
    } else {
        productLink.textContent = 'N/A';
    }

    productData.vendorName = data.vendorName || null;
}

// Function to show loading state
function showLoading() {
    productNameElem.textContent = 'Loading...';
    productQuantityElem.textContent = 'Loading...';
    productLink.textContent = 'Loading...';
}

// Function to show error state
function showError() {
    productNameElem.textContent = 'Error loading product';
    productQuantityElem.textContent = 'N/A';
    productLink.textContent = 'N/A';
}

// Initialize the page
async function initializePage() {
    const uid = params.get('uid');
    
    if (!uid) {
        console.error('No UID found in URL parameters');
        showError();
        return;
    }
    
    showLoading();
    
    try {
        productData = await fetchProductByUID(uid);
        displayProductInfo(productData);
    } catch (error) {
        console.error('Failed to load product data:', error);
        showError();
    }
}

// Order form submission
orderForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!productData) {
        alert('Product data not loaded. Please refresh the page.');
        return;
    }

    const productOrderQuantity = document.getElementById('orderQuantity').value;

    try {
        const response = await fetch("/api/add_order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                uid: params.get('uid'),
                productName: productData.productName,
                productQuantity: productData.productQuantity,
                productURL: productData.productURL,
                productOrderQuantity,
                vendorName: productData.vendorName,
                timestamp: new Date().toISOString()
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

// Initialize the page when it loads
document.addEventListener('DOMContentLoaded', initializePage);