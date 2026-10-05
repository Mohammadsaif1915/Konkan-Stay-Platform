import fs from 'fs';
import path from 'path';

function removeDemoWords(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (filePath.endsWith('search.html')) {
    content = content.replace(/<div class="demo-banner">[\s\S]*?<\/div>/, '');
    content = content.replace(/demo/gi, 'booking');
    content = content.replace(/Simulate successful payment/g, 'Submit Payment');
    content = content.replace(/Simulate declined payment/g, 'Cancel Payment');
    content = content.replace(/Demo payment/g, 'Payment');
    content = content.replace(/Demo ONLY/g, '');
    content = content.replace(/Demo booking confirmed/g, 'Booking confirmed');
    content = content.replace(/Print demo confirmation/g, 'Print confirmation');
  }

  if (filePath.endsWith('README.md')) {
    content = content.replace(/demo/gi, 'feature');
  }

  fs.writeFileSync(filePath, content);
}

removeDemoWords('pages/search.html');
removeDemoWords('README.md');


console.log('Removed demo words from files.');
