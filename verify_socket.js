
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

const patientId = 'test-patient-id';
const conversationId = 'test-conv-id';

socket.on('connect', () => {
    console.log('Connected to server');

    socket.emit('joinRoom', { patientId });
    console.log('Joined patient room');

    // Wait a bit then leave
    setTimeout(() => {
        process.exit(0);
    }, 5000);
});

socket.on('newMessage', (data) => {
    console.log('SUCCESS: Received newMessage event:', data);
    process.exit(0);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});
