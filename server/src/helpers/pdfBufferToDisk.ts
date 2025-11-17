import fs from "fs";
import path from "path";
import { generateReceiptPDF } from "./generateReceiptPDF";

async function testSavePDF() {
  const pdfBuffer = await generateReceiptPDF({
    transaction_id: "ABC123456",
    date: new Date().toISOString(),
    center: "Ikeja Post Office",
    destination: "Abuja",
    sender_name: "John Doe",
    sender_email: "john@example.com",
    service_type: "Parcel Shipment",
    amount_paid: 3500,
    payment_method: "Cash",
    status: "pending",
  });

  // Define output directory and filename
  const outputDir = path.join(process.cwd(), "receipts");
  if (fs.existsSync(outputDir)) fs.rmdirSync(outputDir, { recursive: true });

  fs.mkdirSync(outputDir);

  const filePath = path.join(outputDir, "NIPOST_Receipt_ABC123456.pdf");

  // Write the buffer to a real PDF file
  fs.writeFileSync(filePath, pdfBuffer);

  console.log("✅ PDF saved successfully at:", filePath);
}

testSavePDF();
