const fs = require('fs');
const zlib = require('zlib');

// Read the zip file buffer and find sheet1.xml
const buffer = fs.readFileSync('C:\\Users\\Aaryan shukla\\Desktop\\sales dummy.xlsx');

// In a zip file, local file header signature is 0x04034b50
let offset = 0;
while (offset < buffer.length - 4) {
  if (buffer.readUInt32LE(offset) === 0x04034b50) {
    const fnLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const filename = buffer.toString('utf8', offset + 30, offset + 30 + fnLen);
    const compMethod = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const dataOffset = offset + 30 + fnLen + extraLen;
    
    if (filename === 'xl/worksheets/sheet1.xml') {
      const compData = buffer.slice(dataOffset, dataOffset + compSize);
      let xml = '';
      if (compMethod === 8) {
        xml = zlib.inflateRawSync(compData).toString('utf8');
      } else {
        xml = compData.toString('utf8');
      }
      
      console.log('=== WORKBOOK SHEET1 INSPECTION ===');
      const dimension = xml.match(/<dimension ref="([^"]+)"/);
      if (dimension) console.log('Dimension:', dimension[1]);
      
      const formulas = xml.match(/<f[^>]*>[^<]+<\/f>/g) || [];
      console.log('Formulas found in sheet1:');
      formulas.forEach((f) => console.log('  ', f));
      
      const cells = xml.match(/<c r="([A-Z]+[0-9]+)"[^>]*>/g) || [];
      console.log(`Total cell elements defined: ${cells.length}`);
      console.log('Sample cells:', cells.slice(0, 5), '...', cells.slice(-5));
      break;
    }
    offset = dataOffset + compSize;
  } else {
    offset++;
  }
}
