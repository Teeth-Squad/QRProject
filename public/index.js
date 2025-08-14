const params = new URLSearchParams(window.location.search);
const orderForm = document.getElementById('orderForm');

const productNameElem = document.getElementById('productName');
const productQuantityElem = document.getElementById('productQuantity');
const productLink = document.getElementById('productLink');

let productData = null;

/**
 * Fetch product info from backend by UID
 * @param {string} uid - Unique identifier from QR code
 * @returns {Promise<object>} Product data object
 */
async function fetchProductByUID(uid) {
    try {
        const response = await fetch(`/api/retrieve_qrs?uid=${encodeURIComponent(uid)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch product data');
        }

        const data = await response.json();
        return data[0]; // Expecting array with one result
    } catch (error) {
        console.error('Error fetching product data:', error);
        throw error;
    }
}

/**
 * Fill the page with product info
 * @param {object} data - Product data
 */
function displayProductInfo(data) {
    productNameElem.textContent = data.productName || 'N/A';
    productQuantityElem.textContent = data.productQuantity || 'N/A';
    
    if (data.productURL) {
        productLink.href = data.productURL;
        productLink.textContent = data.productURL;
    } else {
        productLink.textContent = 'N/A';
    }

    productData.vendorName = data.vendorName || null;
}

/** Show loading state while fetching product */
function showLoading() {
    productNameElem.textContent = 'Loading...';
    productQuantityElem.textContent = 'Loading...';
    productLink.textContent = 'Loading...';
}

/** Show error state if fetch fails */
function showError() {
    productNameElem.textContent = 'Error loading product';
    productQuantityElem.textContent = 'N/A';
    productLink.textContent = 'N/A';
}

/** Main page initialization */
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

/** Handle order form submission */
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);