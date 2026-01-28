const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';

async function main() {
    console.log('--- Workflow Trigger Simulation ---');

    // 1. Get Doctor
    const doctor = await prisma.user.findFirst();
    if (!doctor) throw new Error('No doctor found');
    console.log('Doctor:', doctor.email);

    // 2. Create/Get Patient
    let patient = await prisma.patient.findFirst({ where: { email: 'testpatient@example.com' } });
    if (!patient) {
        patient = await prisma.patient.create({
            data: {
                name: 'Test Patient',
                email: 'testpatient@example.com',
                phone: '+15005550006', // Twilio Magic Number for valid SMS
                dob: new Date('1990-01-01'),
                gender: 'Male'
            }
        });
        console.log('Created Patient:', patient.id);
    } else {
        console.log('Using Patient:', patient.id);
    }

    // 3. Create Service
    let service = await prisma.service.findFirst({ where: { name: 'Workflow Test Service' } });
    if (!service) {
        service = await prisma.service.create({
            data: {
                name: 'Workflow Test Service',
                duration: '30 Minutes',
                price: 50,
                type: 'Online'
            }
        });
        console.log('Created Service:', service.id);
    }

    // 4. Create Appointment via API (to trigger service logic)
    // We can't easily call service logic from script without Nest context, 
    // BUT we can use axios to hit the endpoint if the server is running.

    console.log('Sending Appointment Request...');
    try {
        const res = await axios.post(`${API_URL}/appointments`, {
            patientId: patient.id,
            serviceId: service.id,
            doctorId: doctor.id,
            date: new Date().toISOString(),
            time: '10:00 AM',
            status: 'SCHEDULED',
            contextName: patient.name,
            contextEmail: patient.email,
            contextPhone: patient.phone
        });
        console.log('Appointment Created via API:', res.data.id);
        console.log('SUCCESS: Workflow trigger should have fired. Check backend logs.');
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
