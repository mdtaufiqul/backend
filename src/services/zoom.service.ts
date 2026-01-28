import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

interface ZoomMeetingResponse {
    id: string;
    join_url: string;
    start_url: string;
    password?: string;
}

@Injectable()
export class ZoomService {
    private readonly logger = new Logger(ZoomService.name);
    private readonly baseUrl = 'https://api.zoom.us/v2';

    constructor(private prisma: PrismaService) { }

    /**
     * Generate Zoom OAuth2 access token from user credentials
     */
    private async getAccessToken(userId: string): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                zoomClientId: true,
                zoomClientSecret: true,
                zoomAccountId: true,
            },
        });

        if (!user?.zoomClientId || !user?.zoomClientSecret || !user?.zoomAccountId) {
            throw new Error('Zoom credentials not configured for this user');
        }

        try {
            // Use Server-to-Server OAuth for Zoom
            const credentials = Buffer.from(
                `${user.zoomClientId}:${user.zoomClientSecret}`
            ).toString('base64');

            const response = await axios.post(
                `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${user.zoomAccountId}`,
                {},
                {
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return response.data.access_token;
        } catch (error: any) {
            this.logger.error('Failed to get Zoom access token', error.response?.data || error);
            throw new Error('Failed to authenticate with Zoom');
        }
    }

    /**
     * Create a Zoom meeting
     */
    async createMeeting(appointmentId: string, userId: string): Promise<{ url: string; provider: string; meetingId?: string }> {
        try {
            const accessToken = await this.getAccessToken(userId);

            const meetingData = {
                topic: `Medical Consultation - Appointment ${appointmentId}`,
                type: 2, // Scheduled meeting
                duration: 60, // Default 60 minutes
                timezone: 'UTC',
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: true,
                    mute_upon_entry: false,
                    waiting_room: true,
                    audio: 'both',
                    auto_recording: 'none',
                },
            };

            const response = await axios.post<ZoomMeetingResponse>(
                `${this.baseUrl}/users/me/meetings`,
                meetingData,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            this.logger.log(`Created Zoom meeting ${response.data.id} for appointment ${appointmentId}`);

            return {
                url: response.data.join_url,
                provider: 'zoom',
                meetingId: response.data.id.toString(),
            };
        } catch (error: any) {
            this.logger.error('Failed to create Zoom meeting', error.response?.data || error);
            throw new Error('Failed to create Zoom meeting');
        }
    }

    /**
     * Get Zoom meeting details
     */
    async getMeetingUrl(meetingId: string, userId: string): Promise<{ url: string; provider: string }> {
        try {
            const accessToken = await this.getAccessToken(userId);

            const response = await axios.get<ZoomMeetingResponse>(
                `${this.baseUrl}/meetings/${meetingId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            return {
                url: response.data.join_url,
                provider: 'zoom',
            };
        } catch (error: any) {
            this.logger.error('Failed to get Zoom meeting', error.response?.data || error);
            throw new Error('Failed to get Zoom meeting');
        }
    }

    /**
     * Delete a Zoom meeting
     */
    async deleteMeeting(meetingId: string, userId: string): Promise<void> {
        try {
            const accessToken = await this.getAccessToken(userId);

            await axios.delete(
                `${this.baseUrl}/meetings/${meetingId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            this.logger.log(`Deleted Zoom meeting ${meetingId}`);
        } catch (error: any) {
            this.logger.error('Failed to delete Zoom meeting', error.response?.data || error);
            throw new Error('Failed to delete Zoom meeting');
        }
    }

    /**
     * Test Zoom credentials
     */
    async testCredentials(userId: string): Promise<boolean> {
        try {
            await this.getAccessToken(userId);
            return true;
        } catch (error) {
            return false;
        }
    }
}
