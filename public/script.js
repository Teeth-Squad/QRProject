document.getElementById("qrForm").addEventListener("submit", async function (e) {
    e.preventDefault(); // Prevent full-page reload
  
    const formData = new FormData(e.target);
  
    // Debug log for formData content
    console.log('Form Data:', formData);
  
    const response = await fetch("/api/generate-qrcode", {
      method: "POST",
      body: new URLSearchParams(formData)
    });
  
    if (response.ok) {
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      
      const qrImage = document.getElementById("qrImage");
      qrImage.src = imageUrl;
      qrImage.style.display = "block";
    } else {
      alert("Failed to generate QR code.");
    }
  });

