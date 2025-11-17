import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";

export async function generateReceiptPDF(data: any): Promise<Buffer> {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A5", margin: 30 });
      const chunks: Uint8Array[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const {
        transaction_id,
        date,
        center,
        source,
        sender_name,
        sender_email,
        service_type,
        amount_paid,
        payment_method,
        status = "pending",
      } = data;

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // --- HEADER ---
      doc
        .fontSize(18)
        .fillColor("#002366")
        .text("NIPOST DIGITAL RECEIPT", { align: "center" });
      doc
        .fontSize(9)
        .fillColor("gray")
        .text("Official Receipt Generated Electronically", { align: "center" });
      doc.moveDown(1);

      // --- STATUS RIBBON ---
      const statusColors: Record<string, string> = {
        pending: "#FFA500",
        paid: "#28a745",
        failed: "#dc3545",
      };
      const ribbonColor = statusColors[status] || "#FFA500";
      const ribbonHeight = 20;

      doc
        .save()
        .rect(doc.page.margins.left, doc.y, pageWidth, ribbonHeight)
        .fill(ribbonColor);

      doc
        .fillColor("#fff")
        .fontSize(12)
        .text(status.toUpperCase(), doc.page.margins.left, doc.y + 4, {
          width: pageWidth,
          align: "center",
        })
        .restore();

      doc.moveDown(2);

      // --- MAIN CONTENT STARTS ---
      const labelWidth = 300;
      const valueWidth = pageWidth - labelWidth;

      const addLine = (label: string, value: string) => {
        doc
          .fontSize(11)
          .fillColor("#002366")
          .text(label, {
            continued: true,
            width: labelWidth,
            align: "left",
          })
          .fillColor("#000")
          .text(value, { width: valueWidth, align: "left" });
        doc.moveDown(0.5);
      };

      addLine("Transaction ID: ", transaction_id || "N/A");
      addLine("Date: ", new Date(date).toLocaleString());
      // addLine("Service Center: ", center);
      addLine("Origin Post Office : ", source);
      addLine("Service Type: ", service_type);

      doc.moveDown(1);

      // --- CUSTOMER DETAILS ---
      doc
        .fontSize(12)
        .fillColor("#002366")
        .text("CUSTOMER DETAILS", { underline: true });
      doc.moveDown(0.5);
      addLine("Name: ", sender_name || "N/A");
      addLine("Email: ", sender_email || "N/A");

      doc.moveDown(1);

      // --- PAYMENT DETAILS ---
      doc
        .fontSize(12)
        .fillColor("#002366")
        .text("PAYMENT DETAILS", { underline: true });

      const formattedAmount = new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(amount_paid);

      addLine("Amount Paid: N", amount_paid.toLocaleString("en-NG"));
      addLine("Payment Method: ", payment_method);

      doc.moveDown(1);

      // --- QR CODE ---
      const qrData = `https://verify.nipost.gov.ng/receipts/${transaction_id}`;
      const qrImage = await QRCode.toDataURL(qrData, { margin: 1, width: 100 });
      const qrBuffer = Buffer.from(qrImage.split(",")[1], "base64");
      const qrSize = 80;
      const qrX = doc.page.width / 2 - qrSize / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: qrSize });
      doc.moveDown(0.5);
      doc
        .fontSize(8)
        .fillColor("gray")
        .text("Scan to verify receipt", { align: "center" });

      doc.moveDown(8);

      // --- FOOTER ---
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(
          "This is a computer-generated receipt. No signature is required.",
          {
            align: "center",
          }
        );

      // --- WATERMARK (ABSOLUTE, BACKGROUND) ---
      const watermarkText = "NIPOST";
      doc.save();
      doc.fontSize(90).fillColor("#E0E0E0").opacity(0.25);

      const textWidth = doc.widthOfString(watermarkText);
      const textHeight = doc.currentLineHeight();
      const x = (doc.page.width - textWidth) / 2;
      const y = (doc.page.height - textHeight) / 2;

      doc.rotate(45, { origin: [x, y] });
      doc.text(watermarkText, x, y, { lineBreak: false });
      doc.restore();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
