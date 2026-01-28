import { Controller, Get, Post, Body, Param, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { EmailTokensService } from '../services/email-tokens.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsGateway } from '../appointments/appointments.gateway';

@Controller('email')
export class EmailActionsController {
    constructor(
        private readonly emailTokensService: EmailTokensService,
        private readonly prisma: PrismaService,
        private readonly appointmentsGateway: AppointmentsGateway
    ) { }

    /**
     * Confirm appointment via email token
     */
    @Get('confirm')
    async confirmAppointment(@Query('token') token: string, @Res() res: Response) {
        try {
            const emailToken = await this.emailTokensService.validateToken(token);

            if (emailToken.action !== 'CONFIRM') {
                throw new BadRequestException('Invalid token action');
            }

            // Perform Confirmation
            await this.prisma.appointment.update({
                where: { id: emailToken.appointmentId },
                data: {
                    isConfirmed: true,
                    status: 'confirmed'
                }
            });

            // Consume Token
            await this.emailTokensService.consumeToken(token);

            // Notify Real-time
            this.appointmentsGateway.notifyAppointmentUpdate();

            // Redirect to success page
            // Use environment variable for frontend URL, fallback to relative
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/public/appointment/success?action=confirmed`);

        } catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/public/appointment/error?message=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * Cancel appointment via email token
     */
    @Get('cancel')
    async cancelAppointment(@Query('token') token: string, @Res() res: Response) {
        try {
            const emailToken = await this.emailTokensService.validateToken(token);

            if (emailToken.action !== 'CANCEL') {
                throw new BadRequestException('Invalid token action');
            }

            // Perform Cancellation
            await this.prisma.appointment.update({
                where: { id: emailToken.appointmentId },
                data: {
                    status: 'cancelled',
                    notes: 'Cancelled by patient via email'
                }
            });

            // Consume Token
            await this.emailTokensService.consumeToken(token);

            // Notify Real-time
            this.appointmentsGateway.notifyAppointmentUpdate();

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/public/appointment/success?action=cancelled`);

        } catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/public/appointment/error?message=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * Reschedule appointment via email token
     * Redirects to a public reschedule page with the token
     */
    @Get('reschedule')
    async rescheduleAppointment(@Query('token') token: string, @Res() res: Response) {
        try {
            // Just validate, don't consume yet (consumed upon actual reschedule submission)
            const emailToken = await this.emailTokensService.validateToken(token);

            if (emailToken.action !== 'RESCHEDULE') {
                throw new BadRequestException('Invalid token action');
            }

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            // Redirect to frontend reschedule page with token
            return res.redirect(`${frontendUrl}/public/appointment/reschedule?token=${token}`);

        } catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/public/appointment/error?message=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * Process reschedule submission
     */
    @Post('reschedule')
    async processReschedule(@Body() body: { token: string; newDate: string }, @Res() res: Response) {
        try {
            const { token, newDate } = body;
            const emailToken = await this.emailTokensService.validateToken(token);

            if (emailToken.action !== 'RESCHEDULE') {
                throw new BadRequestException('Invalid token action');
            }

            // Perform Reschedule
            await this.prisma.appointment.update({
                where: { id: emailToken.appointmentId },
                data: {
                    date: new Date(newDate),
                    status: 'scheduled', // Reset status if it was waitlist/cancelled?
                    isConfirmed: true // Auto-confirm rescheduled? Or keep false?
                }
            });

            // Consume Token
            await this.emailTokensService.consumeToken(token);

            // Notify
            this.appointmentsGateway.notifyAppointmentUpdate();

            return res.status(200).json({ success: true });

        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * Get details for the specific token (to load context in frontend)
     */
    @Get('details')
    async getTokenDetails(@Query('token') token: string, @Res() res: Response) {
        try {
            const emailToken = await this.emailTokensService.validateToken(token);
            // Return safe details
            return res.json({
                doctorName: emailToken.appointment.doctor.name,
                doctorId: emailToken.appointment.doctorId,
                patientName: emailToken.appointment.patient?.name || emailToken.appointment.guestName,
                serviceDuration: emailToken.appointment.service?.duration || 30,
                type: emailToken.appointment.type,
                clinicId: emailToken.appointment.clinicId,
                timezone: emailToken.appointment.clinic?.timezone || 'UTC'
            });
        } catch (error) {
            return res.status(400).json({ message: 'Invalid token' });
        }
    }

    /**
     * Track email open (1x1 pixel)
     */
    @Get('open')
    async trackOpen(@Query('token') token: string, @Res() res: Response) {
        // Pixel image data (1x1 transparent gif)
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
        res.end(pixel);
    }

    /**
     * Add to Calendar (Google, Outlook, ICS)
     */
    @Get('calendar')
    async addToCalendar(
        @Query('token') token: string,
        @Query('type') type: 'google' | 'outlook' | 'ics',
        @Res() res: Response
    ) {
        try {
            // Validate token (no burn)
            const emailToken = await this.emailTokensService.validateToken(token);
            if (emailToken.action !== 'CALENDAR') {
                throw new BadRequestException('Invalid token action');
            }

            const appt = emailToken.appointment;
            const startTime = new Date(appt.date);
            // Calculate end time
            // Duration is string "30 min" etc, or "30". Parse safely.
            const duration = appt.service?.duration ? parseInt(appt.service.duration) : 30;
            const endTime = new Date(startTime.getTime() + duration * 60000);

            const title = `Appointment with ${appt.doctor.name}`;
            const description = appt.notes || 'No description';
            const location = appt.clinic?.address || (appt.type === 'video' ? 'Video Call' : 'TBD');

            if (type === 'google') {
                // Generate Google Calendar Link
                const startStr = startTime.toISOString().replace(/-|:|\.\d+/g, '');
                const endStr = endTime.toISOString().replace(/-|:|\.\d+/g, '');
                const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
                return res.redirect(url);
            } else if (type === 'outlook') {
                // Generate Outlook Link (Web)
                // Note: Outlook web link format
                const startStr = startTime.toISOString();
                const endStr = endTime.toISOString();
                const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}&startdt=${startStr}&enddt=${endStr}`;
                return res.redirect(url);
            } else if (type === 'ics') {
                // Generate ICS File content
                const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MediFlow//App//EN
BEGIN:VEVENT
UID:${appt.id}
DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d+/g, '')}
DTSTART:${startTime.toISOString().replace(/-|:|\.\d+/g, '')}
DTEND:${endTime.toISOString().replace(/-|:|\.\d+/g, '')}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`;

                res.setHeader('Content-Type', 'text/calendar');
                res.setHeader('Content-Disposition', 'attachment; filename="appointment.ics"');
                res.send(icsContent);
            } else {
                throw new BadRequestException('Invalid calendar type');
            }

        } catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/public/appointment/error?message=${encodeURIComponent(error.message)}`);
        }
    }
}
