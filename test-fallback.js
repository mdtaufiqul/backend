const axios = require('axios');

async function trigger() {
    try {
        const res = await axios.post('http://localhost:3001/api/appointments', {
            doctorId: "3a1a1420-f1c1-4ca2-9512-620746afe18c", // Existing doc
            patientId: "e1ab559b-d18c-41f5-b4db-6b164f920b18", // Test patient
            date: new Date().toISOString(),
            type: "video",
            notes: "Fallback Flow Verification"
        });
        console.log("Appointment Created:", res.data.id);
    } catch (e) {
        console.error("Error:", e.response?.data || e.message);
    }
}

trigger();
