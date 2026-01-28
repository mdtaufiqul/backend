
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class DailyService {
    private readonly logger = new Logger(DailyService.name);
    private readonly apiKey = '715a7b3140c2667bce9f22f29ce1f613b20a37471e1efdcdb4ad285900c96e4f'; // In production, move to env
    private readonly baseUrl = 'https://api.daily.co/v1';

    async createRoom(roomName: string): Promise<string> {
        try {
            const response = await axios.post(
                `${this.baseUrl}/rooms`,
                {
                    name: roomName,
                    privacy: 'public', // For MVP. Use 'private' + tokens for security later.
                    properties: {
                        enable_chat: true,
                        enable_screenshare: true,
                        enable_recording: 'cloud',
                        exp: Math.round(Date.now() / 1000) + 24 * 60 * 60, // 24 hours expiry
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data.url;
        } catch (error: any) {
            if (error.response && error.response.data) {
                // If room already exists, we might get an error (depending on exact API behavior for 'name')
                // but Daily API usually returns 200 with existing room if we just GET it, 
                // or 400 if we try to CREATE duplicate name.
                // Let's handle 400 "already exists"
                if (error.response.status === 400 && error.response.data.info?.includes('already exists')) {
                    this.logger.log(`Room ${roomName} already exists, fetching details.`);
                    // Fetch the room to get the URL
                    try {
                        const getRes = await axios.get(`${this.baseUrl}/rooms/${roomName}`, {
                            headers: { Authorization: `Bearer ${this.apiKey}` }
                        });
                        return getRes.data.url;
                    } catch (getErr) {
                        this.logger.error(`Failed to fetch existing room ${roomName}`, getErr);
                        throw getErr;
                    }
                }
                this.logger.error('Failed to create Daily room', error.response.data);
            } else {
                this.logger.error('Failed to create Daily room', error);
            }
            throw error;
        }
    }
}
