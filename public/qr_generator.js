const qrForm = document.getElementById('qrForm');
const qrImage = document.getElementById('qrImage');
const printBtn = document.getElementById('printBtn');
const qrWrapper = document.getElementById('qrWrapper');

// Generate QR code when submit button is clicked
qrForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const productName = document.getElementById('productName').value;
  const productUrl = document.getElementById('productUrl').value;
  const qrData = `Product: ${productName}, URL: ${productUrl}`;

  // Generate the QR code
  QRCode.toDataURL(qrData, { width: 150, height: 150 }, async function(err, url) {
    if (err) {
      console.error("Error generating QR code:", err);
      return;
    }

    // Display QR code on page
    qrImage.src = url;
    qrWrapper.style.display = 'block';
    printBtn.style.display = 'inline';

	// Send QR code to database via API
	try {
		const response = await fetch("/api/send_qr", {
		  method: "POST",
		  headers: {
			"Content-Type": "application/json"
		  },
		  body: JSON.stringify({
			productName: productName,
			productUrl: productUrl,
			qrCodeDataUrl: url 
		  })
		});
  
		// Error checking 
		if (!response.ok) {
		  throw new Error("Failed to send QR code to server");
		}
  
		console.log("QR code sent to server");
	  } catch (error) {
		console.error(error);
		alert("Failed to send QR code to server");
	  }
	});
  });
  
  // Print Button
  printBtn.addEventListener('click', function() {
	const printWindow = window.open('', '', 'width=600,height=400');
	printWindow.document.write('<html><head><title>Print QR Code</title></head><body>');
	printWindow.document.write('<img src="' + qrImage.src + '" style="border: 1px solid #ccc; max-width: 100%;"/>');
	printWindow.document.write('</body></html>');
	printWindow.document.close();
	printWindow.print();
  });