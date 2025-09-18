// Wait until DOM is fully loaded before running scripts
document.addEventListener('DOMContentLoaded', () => {

    // DOM element references
    const qrCodes = document.getElementById('qrCodes');
    const searchInput = document.getElementById('searchInput');
    const qrForm = document.getElementById('QRCodeForm');
    const modalElement = document.getElementById('addQRCodeModal');
    const vendorSelect = document.getElementById('vendorSelect');

    // Store all QR codes for filtering
    let allCodes = [];

    /**
     * Reset form when modal is hidden
     */
    modalElement.addEventListener("hide.bs.modal", () => {
        const focused = modalElement.querySelector(":focus");
        if (focused) focused.blur();
        qrForm.reset();
    });

    /**
     * Generate a unique identifier for a QR code
     * @returns {string} Unique ID
     */
    function generateUID() {
        return 'qr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Fetch vendor list from API and populate dropdown
     */
    async function fetchVendors() {
        try {
            const res = await fetch('/api/retrieve_vendors');
            if (!res.ok) throw new Error('Failed to fetch vendors');
            const vendors = await res.json();

            // Default option
            vendorSelect.innerHTML = '<option value="N/A">N/A</option>';

            // Populate dropdown with vendors
            vendors.forEach(vendor => {
                const option = document.createElement('option');
                option.value = vendor._id;
                option.textContent = vendor.vendorName;
                vendorSelect.appendChild(option);
            });

        } catch (err) {
            console.error('Vendor fetch error:', err);
            vendorSelect.innerHTML = '<option disabled>Error loading vendors</option>';
        }
    }

    /**
     * Fetch all QR codes from API
     */
    async function fetchAllCodes() {
        try {
            const response = await fetch('/api/retrieve_qrs');
            if (!response.ok) throw new Error('Failed to fetch QR codes');
            allCodes = await response.json();
            filterAndRender(searchInput.value.trim());

        } catch (err) {
            qrCodes.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
            console.error(err);
        }
    }

    /**
     * Filter QR codes based on search term and render them
     * @param {string} searchTerm - User's search input
     */
    function filterAndRender(searchTerm) {
        const filtered = allCodes.filter(code =>
            code.productName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        filtered.sort((a, b) => a.productName.localeCompare(b.productName));
        renderCodes(filtered);
    }

    /**
     * Render QR codes into table format
     * @param {Array} data - List of QR code objects
     */
    function renderCodes(data) {
        if (!data.length) {
            qrCodes.innerHTML = `<p class="text-muted">No QR codes found.</p>`;
            return;
        }

        // Table header
        let tableHTML = `
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th style="text-align: center;"><input type="checkbox" id="selectAll"></th>
                        <th style="text-align: center;">QR Code</th>
                        <th style="text-align: center;">Name</th>
                        <th style="text-align: center;">URL</th>
                        <th style="text-align: center;">Vendor</th>
                        <th style="text-align: center;">Create Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Table rows
        data.forEach(code => {
            const createdAtFormatted = new Date(code.createdAt).toLocaleString();
            tableHTML += `
                <tr id="qrCard-${code._id}">
                    <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">
                        <input type="checkbox" class="row-checkbox" data-id="${code._id}">
                    </td>
                    <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">
                        <img id="qrImg-${code._id}" src="${code.qrCodeDataURL}" alt="QR Code" width="80" class="img-fluid rounded border">
                    </td>
                    <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${code.productName}</td>
                    <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">
                        <a href="${code.productURL}" target="_blank">Product Order Page</a>
                    </td>
                    <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${code.vendorName}</td>
                    <td style="vertical-align: middle; text-align: center; border-right: 1px solid #dee2e6; border-left: 1px solid #dee2e6;">${createdAtFormatted}</td>
                </tr>
            `;
        });

        // Close table
        tableHTML += `</tbody></table>`;
        qrCodes.innerHTML = tableHTML;

        // Select-all checkbox behavior
        const selectAllCheckbox = document.getElementById('selectAll');
        selectAllCheckbox.addEventListener('change', (e) => {
            const checked = e.target.checked;
            qrCodes.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.checked = checked;
            });
        });
    }

    /**
     * Delete selected QR codes from the database
     */
    document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
        const selectedCheckboxes = qrCodes.querySelectorAll('.row-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('No QR codes selected.');
            return;
        }

        if (!confirm(`Delete ${selectedCheckboxes.length} selected QR code(s)?`)) return;

        const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));

        try {
            for (const id of idsToDelete) {
                const res = await fetch(`/api/delete_qrs?id=${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(`Failed to delete item with id ${id}`);
            }

            // Update local data after deletion
            allCodes = allCodes.filter(code => !idsToDelete.includes(code._id));
            filterAndRender(searchInput.value.trim());

        } catch (err) {
            alert(`Error deleting selected QR codes: ${err.message}`);
        }
    });

    /**
     * Print selected QR codes in a formatted layout
     */
    function printSelectedQRCodes() {
        const checkedBoxes = document.querySelectorAll('#qrCodes .row-checkbox:checked');

        if (checkedBoxes.length === 0) {
            alert('Please select at least one QR code to print.');
            return;
        }

        // Start building print HTML
        let printContent = `
            <html>
            <head>
                <title>Print QR Codes</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .qr-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-start; }
                    .qr-item {
                        border: 1px solid #ddd;
                        padding: 5px;
                        width: calc(25% - 20px);
                        box-sizing: border-box;
                        text-align: center;
                        page-break-inside: avoid;
                    }
                    .qr-item img { max-width: 75px; height: auto; margin-bottom: 5px; }
                    .qr-item .name { font-weight: bold; margin-bottom: 5px; }
                    .qr-item .vendor { color: #555; font-size: 0.7em; }
                    .qr-item .uid { color: #888; font-size: 0.8em; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="qr-grid">
        `;

        // Add selected codes to print layout
        checkedBoxes.forEach(checkbox => {
            const tr = checkbox.closest('tr');
            if (!tr) return;

            const img = tr.querySelector('img');
            const name = tr.cells[2]?.textContent || '';

            printContent += `
                <div class="qr-item">
                    <img src="${img?.src || ''}" alt="QR code for ${name}" />
                    <div class="name">${name}</div>
                </div>
            `;
        });

        // Close print HTML
        printContent += `
                </div>
            </body>
            </html>
        `;

        // Open print window
        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Print when content loads
        printWindow.onload = function () {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };
    }

    // Bind print button
    document.getElementById('printSelectedBtn').addEventListener('click', printSelectedQRCodes);

    /**
     * Handle QR code creation form submission
     */
    qrForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const submitBtn = qrForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const productName = document.getElementById('productName').value.trim();
            const productQuantity = document.getElementById('productQuantity').value.trim();
            const productURL = document.getElementById('productURL').value.trim();
            const vendorId = vendorSelect.value;

            // Generate unique identifier for this QR code
            const uid = generateUID();

            // Create QR code data
            const baseURL = window.location.origin + "/mobile_order.html";
            const qrData = `${baseURL}?uid=${uid}`;

            // Generate QR code image
            QRCode.toDataURL(qrData, { width: 150, height: 150 }, async function (err, qrCodeDataURL) {
                if (err) {
                    console.error("Error generating QR code:", err);
                    submitBtn.disabled = false;
                    return;
                }

                try {
                    // Save QR code to database
                    const res = await fetch('/api/add_qrs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            uid: uid,
                            productName: productName,
                            productQuantity: productQuantity,
                            productURL: productURL,
                            vendorId: vendorId,
                            qrCodeDataURL: qrCodeDataURL
                        })
                    });

                    if (!res.ok) throw new Error('Failed to add QR Code');

                    // Reset form and refresh list
                    qrForm.reset();
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    modal.hide();
                    await fetchAllCodes();

                } catch (err) {
                    alert(`Error: ${err.message}`);
                }

                submitBtn.disabled = false;
            });

        } catch (err) {
            console.error("Submission error:", err);
            alert("Something went wrong. Please try again.");
            submitBtn.disabled = false;
        }
    });

    /**
     * Filter QR codes as user types
     */
    searchInput.addEventListener('input', () => {
        filterAndRender(searchInput.value.trim());
    });

    // Initial data fetch
    fetchAllCodes();
    fetchVendors();

});