const nodemailer = require('nodemailer');
require('dotenv').config();

async function testResend() {
    const resendApiKey = process.env.RESEND_API_KEY;
    console.log('API Key:', resendApiKey);

    const transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
            user: 'resend',
            pass: resendApiKey,
        },
    });

    try {
        console.log('Testing connection to port 465...');
        await transporter.verify();
        console.log('Connection successful!');
    } catch (error) {
        console.error('Connection failed (465):', error.message);

        console.log('Testing connection to port 587...');
        const transporter587 = nodemailer.createTransport({
            host: 'smtp.resend.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: 'resend',
                pass: resendApiKey,
            },
        });

        try {
            await transporter587.verify();
            console.log('Connection successful (587)!');
        } catch (error587) {
            console.error('Connection failed (587):', error587.message);
        }
    }
}

testResend();
