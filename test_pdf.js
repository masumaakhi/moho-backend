const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

try {
  console.log("Initializing PDFKit Document...");
  const doc = new PDFDocument();
  const outputPath = path.join(__dirname, 'test_report.pdf');
  const stream = fs.createWriteStream(outputPath);

  doc.pipe(stream);

  // Styling PDF Test
  doc.fontSize(22).fillColor('#146C4A').text('Mohul BI - Financial Ledger Report (Test)', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#6B7280').text('View Channel: MANUAL LEDGER PORTION', { align: 'center' });
  doc.moveDown(2);

  const metrics = [
    ['Total Manual Sales', 'BDT 125,000'],
    ['Ad Spend (USD)', '$150.0'],
    ['Courier Packaging Costs', 'BDT 4,500'],
    ['Estimated Handled Profit', 'BDT 98,500'],
  ];

  metrics.forEach(([label, value]) => {
    doc.fontSize(12).fillColor('#374151').text(`${label}: `, { continued: true });
    doc.fontSize(13).fillColor('#111827').font('Helvetica-Bold').text(value);
    doc.moveDown(0.8);
    doc.font('Helvetica');
  });

  doc.moveDown(3);
  doc.fontSize(9).fillColor('#9CA3AF').text('Generated programmatically in workspace by Mohul BI.', { align: 'center' });

  doc.end();
  
  stream.on('finish', () => {
    console.log(`Success! PDF report written to: ${outputPath}`);
  });
} catch (err) {
  console.error("PDF generation failed:", err);
}
