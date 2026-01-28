import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

interface GoogleMeetResponse {
    hangoutLink?: string;
    conferenceData?: {
        entryPoints?: Array<{
            entryPointType: string;
            uri: string;
        }>;
    };
}

@Injectable()
export class GoogleMeetService {
    private readonly logger = new Logger(GoogleMeetService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Get OAuth2 client for a user
     */
    private async getOAuth2Client(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                googleClientId: true,
                googleClientSecret: true,
                googleRefreshToken: true,
            },
        });

        if (!user?.googleClientId || !user?.googleClientSecret || !user?.googleRefreshToken) {
            throw new Error('Google Meet credentials not configured for this user');
        }

        const oauth2Client = new google.auth.OAuth2(
            user.googleClientId,
            user.googleClientSecret,
            'http://localhost:3000/settings/google-callback' // Redirect URI
        );

        oauth2Client.setCredentials({
            refresh_token: user.googleRefreshToken,
        });

        return oauth2Client;
    }

    /**
     * Create a Google Calendar event with Meet link
     */
    async createMeeting(
        appointmentId: string,
        userId: string,
        startTime?: Date,
        duration: number = 60
    ): Promise<{ url: string; provider: string; eventId?: string }> {
        try {
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            // Calculate start and end times
            const start = startTime || new Date();
            const end = new Date(start.getTime() + duration * 60000);

            const event = {
                summary: `Medical Consultation - Appointment ${appointmentId}`,
                description: 'Virtual medical consultation via Google Meet',
                start: {
                    dateTime: start.toISOString(),
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: end.toISOString(),
                    timeZone: 'UTC',
                },
                conferenceData: {
                    createRequest: {
                        requestId: `appt-${appointmentId}`,
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet',
                        },
                    },
                },
                attendees: [],
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
                conferenceDataVersion: 1,
            });

            const meetLink =
                response.data.hangoutLink ||
                response.data.conferenceData?.entryPoints?.find(
                    (ep) => ep.entryPointType === 'video'
                )?.uri;

            if (!meetLink) {
                throw new Error('Failed to generate Google Meet link');
            }

            this.logger.log(`Created Google Meet for appointment ${appointmentId}`);

            return {
                url: meetLink,
                provider: 'google-meet',
                eventId: response.data.id || undefined,
            };
        } catch (error: any) {
            this.logger.error('Failed to create Google Meet', error);
            throw new Error('Failed to create Google Meet');
        }
    }

    /**
     * Get Google Calendar event details
     */
    async getMeetingUrl(eventId: string, userId: string): Promise<{ url: string; provider: string }> {
        try {
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const response = await calendar.events.get({
                calendarId: 'primary',
                eventId: eventId,
            });

            const meetLink =
                response.data.hangoutLink ||
                response.data.conferenceData?.entryPoints?.find(
                    (ep) => ep.entryPointType === 'video'
                )?.uri;

            if (!meetLink) {
                throw new Error('Google Meet link not found');
            }

            return {
                url: meetLink,
                provider: 'google-meet',
            };
        } catch (error: any) {
            this.logger.error('Failed to get Google Meet', error);
            throw new Error('Failed to get Google Meet');
        }
    }

    /**
     * Delete a Google Calendar event
     */
    async deleteMeeting(eventId: string, userId: string): Promise<void> {
        try {
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId,
            });

            this.logger.log(`Deleted Google Calendar event ${eventId}`);
        } catch (error: any) {
            this.logger.error('Failed to delete Google Calendar event', error);
            throw new Error('Failed to delete Google Calendar event');
        }
    }

    /**
     * Test Google credentials
     */
    async testCredentials(userId: string): Promise<boolean> {
        try {
            const oauth2Client = await this.getOAuth2Client(userId);
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            // Try to list calendars to verify credentials
            await calendar.calendarList.list({ maxResults: 1 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate OAuth2 authorization URL
     */
    generateAuthUrl(clientId: string, clientSecret: string): string {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3000/settings/google-callback'
        );

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
        ];

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(
        code: string,
        clientId: string,
        clientSecret: string
    ): Promise<string> {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3000/settings/google-callback'
        );

        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            throw new Error('No refresh token received');
        }

        return tokens.refresh_token;
    }
}
