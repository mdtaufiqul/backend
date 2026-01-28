import {
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class AppointmentsGateway {
    @WebSocketServer()
    server: Server;

    notifyAppointmentUpdate() {
        this.server.emit('appointmentUpdated');
    }
}
