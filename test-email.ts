import 'dotenv/config';
import { sendEmail } from './src/lib/emailService';

async function test() {
  console.log('Sending test email...');
  const result = await sendEmail({
    to: 'getdeliverysystem@gmail.com',
    subject: 'Test Email',
    html: '<p>Test</p>'
  });
  console.log('Result:', result);
  process.exit(0);
}
test();
