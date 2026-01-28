import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailTemplatesService {
    constructor(private prisma: PrismaService) { }

    private extractVariables(content: string): string[] {
        const regex = /{{([\w\.]+)}}/g;
        const matches = new Set<string>();
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.add(match[1]);
        }
        return Array.from(matches);
    }

    async create(data: any) {
        // Auto-extract variables from bodyText and bodyHtml
        const variables = new Set([
            ...this.extractVariables(data.bodyText || ''),
            ...this.extractVariables(data.bodyHtml || ''),
            ...this.extractVariables(data.subject || '')
        ]);

        return this.prisma.emailTemplate.create({
            data: {
                ...data,
                variables: Array.from(variables)
            }
        });
    }

    async findAll(user: any, targetClinicId?: string) {
        const { clinicId: userClinicId, role } = user;
        // Use provided clinicId, or fall back to user's clinicId
        const clinicId = targetClinicId || userClinicId;
        const where: any = {};

        if (clinicId) {
            where.OR = [
                { clinicId: clinicId },
                { clinicId: null }
            ];
        } else if (role !== 'SYSTEM_ADMIN' && role !== 'SAAS_OWNER') {
            // If not admin and no clinicId, return nothing
            return [];
        }

        const templates = await this.prisma.emailTemplate.findMany({
            where,
            orderBy: [{ clinicId: 'desc' }, { updatedAt: 'desc' }] // Prioritize clinic-specific (non-null)
        });

        // Deduplicate system templates by category if we are in a clinic context
        if (clinicId) {
            const seenCategories = new Set();
            return templates.filter(t => {
                if (!t.isSystem) return true; // Keep all non-system templates
                if (seenCategories.has(t.category)) return false; // Skip if we already have this category
                seenCategories.add(t.category);
                return true;
            });
        }

        return templates;
    }

    async findOne(id: string) {
        return this.prisma.emailTemplate.findUnique({
            where: { id }
        });
    }

    async update(id: string, data: any) {
        // Re-extract variables if content changed
        let variables: string[] | undefined;
        if (data.bodyText || data.bodyHtml || data.subject) {
            const vars = new Set([
                ...this.extractVariables(data.bodyText || ''),
                ...this.extractVariables(data.bodyHtml || ''),
                ...this.extractVariables(data.subject || '')
            ]);
            variables = Array.from(vars);
        }

        return this.prisma.emailTemplate.update({
            where: { id },
            data: {
                ...data,
                ...(variables ? { variables } : {})
            }
        });
    }

    async remove(id: string) {
        const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
        if (template?.isSystem) {
            throw new Error('Cannot delete system templates');
        }
        return this.prisma.emailTemplate.delete({
            where: { id }
        });
    }

    async seedSystemTemplates(clinicId?: string) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        const templates = [
            {
                name: 'Appointment Confirmation',
                category: 'APPOINTMENT_CONFIRMATION',
                isSystem: true,
                subject: 'Appointment Confirmed - {{appointment.date}} at {{appointment.time}}',
                bodyHasHtml: true,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #2563eb;">Appointment Confirmed ✓</h2>
                        <p>Hello {{patient.name}},</p>
                        <p>Your appointment with Dr. {{doctor.name}} has been confirmed.</p>
                        
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Date:</strong> {{appointment.date}}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> {{appointment.time}}</p>
                            <p style="margin: 5px 0;"><strong>Service:</strong> {{service.name}}</p>
                            <p style="margin: 5px 0;"><strong>Type:</strong> {{appointment.type}}</p>
                        </div>
                        
                        {{#if video_link}}
                        <div style="margin-top: 20px; padding: 20px; background: #eef2ff; border-radius: 8px; text-align: center;">
                            <p style="margin-bottom: 15px;"><strong>This is a virtual appointment.</strong></p>
                            <a href="{{video_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Join Video Meeting
                            </a>
                        </div>
                        {{/if}}

                         {{#if intake_link}}
                        <div style="margin-top: 20px; padding: 20px; border: 2px dashed #2563eb; border-radius: 8px; background: #f0f7ff;">
                            <p style="margin-bottom: 10px;"><strong>Action Required: Complete Your Intake Form</strong></p>
                            <p style="font-size: 14px; margin-bottom: 15px;">Please provide your medical history before your visit to help us prepare.</p>
                            <a href="{{intake_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Fill Out Intake Form
                            </a>
                        </div>
                        {{/if}}

                        {{#if mapLink}}
                        <div style="margin-top: 20px; padding: 20px; background: #f0fdf4; border-radius: 8px;">
                            <p style="margin-bottom: 10px;"><strong>In-Person Location:</strong></p>
                            <p style="margin: 5px 0;">{{clinicAddress}}</p>
                            <a href="{{mapLink}}" style="display: inline-block; margin-top: 10px; color: #16a34a; font-weight: bold; text-decoration: none;">
                                📍 View on Google Maps
                            </a>
                            {{#if mapPin}}
                            <div style="margin-top: 15px;">
                                <img src="{{mapPin}}" alt="Location Map" style="width: 100%; border-radius: 6px; border: 1px solid #ddd;" />
                            </div>
                            {{/if}}
                        </div>
                        {{/if}}
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="font-size: 14px; color: #666;">Need to make changes?</p>
                            <p>
                                <a href="{{confirm_link}}" style="color: #16a34a; text-decoration: none; margin-right: 15px;">✓ Confirm</a>
                                <a href="{{reschedule_link}}" style="color: #2563eb; text-decoration: none; margin-right: 15px;">↻ Reschedule</a>
                                <a href="{{cancel_link}}" style="color: #dc2626; text-decoration: none;">✕ Cancel</a>
                            </p>
                        </div>
                    </div>
                `,
                bodyText: `Appointment Confirmed\n\nHello {{patient.name}},\n\nYour appointment with Dr. {{doctor.name}} has been confirmed.\n\nDate: {{appointment.date}}\nTime: {{appointment.time}}\nService: {{service.name}}\nType: {{appointment.type}}\n\n{{#if intake_link}}Complete Intake Form: {{intake_link}}\n{{/if}}{{#if video_link}}Join Video: {{video_link}}\n{{/if}}{{#if mapLink}}Location: {{clinicAddress}}\nMap: {{mapLink}}\n{{/if}}\n\nConfirm: {{confirm_link}}\nReschedule: {{reschedule_link}}\nCancel: {{cancel_link}}`,
                variables: ['patient.name', 'doctor.name', 'appointment.date', 'appointment.time', 'service.name', 'appointment.type', 'cancel_link', 'reschedule_link', 'confirm_link', 'video_link', 'mapLink', 'clinicAddress', 'mapPin', 'intake_link']
            },
            {
                name: 'Appointment Reminder',
                category: 'APPOINTMENT_REMINDER',
                isSystem: true,
                subject: 'Reminder: Appointment Tomorrow at {{appointment.time}}',
                bodyHasHtml: true,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #f59e0b;">Appointment Reminder 🔔</h2>
                        <p>Hello {{patient.name}},</p>
                        <p>This is a friendly reminder about your upcoming appointment.</p>
                        
                        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                            <p style="margin: 5px 0;"><strong>Doctor:</strong> Dr. {{doctor.name}}</p>
                            <p style="margin: 5px 0;"><strong>Date:</strong> {{appointment.date}}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> {{appointment.time}}</p>
                            <p style="margin: 5px 0;"><strong>Service:</strong> {{service.name}}</p>
                        </div>
                        
                        {{#if video_link}}
                        <p style="margin-top: 20px;">
                            <a href="{{video_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Join Video Meeting
                            </a>
                        </p>
                        {{/if}}

                        {{#if mapLink}}
                        <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px;">
                            <p style="margin-bottom: 5px;"><strong>Location:</strong> {{clinicAddress}}</p>
                            <a href="{{mapLink}}" style="color: #16a34a; font-weight: bold; text-decoration: none;">📍 View on Maps</a>
                        </div>
                        {{/if}}
                        
                        <div style="margin-top: 30px;">
                            <p style="font-size: 14px; color: #666;">Can't make it?</p>
                            <p>
                                <a href="{{reschedule_link}}" style="color: #2563eb; text-decoration: none; margin-right: 15px;">Reschedule</a>
                                <a href="{{cancel_link}}" style="color: #dc2626; text-decoration: none;">Cancel</a>
                            </p>
                        </div>
                    </div>
                `,
                bodyText: `Appointment Reminder\n\nHello {{patient.name}},\n\nThis is a reminder about your upcoming appointment.\n\nDoctor: Dr. {{doctor.name}}\nDate: {{appointment.date}}\nTime: {{appointment.time}}\nService: {{service.name}}\n\n{{#if video_link}}Join Video: {{video_link}}\n{{/if}}{{#if mapLink}}Location: {{clinicAddress}}\nMap: {{mapLink}}\n{{/if}}\n\nReschedule: {{reschedule_link}}\nCancel: {{cancel_link}}`,
                variables: ['patient.name', 'doctor.name', 'appointment.date', 'appointment.time', 'service.name', 'cancel_link', 'reschedule_link', 'video_link', 'mapLink', 'clinicAddress']
            },
            {
                name: 'Appointment Rescheduled',
                category: 'APPOINTMENT_RESCHEDULED',
                isSystem: true,
                subject: 'Appointment Rescheduled - New Time: {{appointment.date}} at {{appointment.time}}',
                bodyHasHtml: true,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #2563eb;">Appointment Rescheduled</h2>
                        <p>Hello {{patient.name}},</p>
                        <p>Your appointment with Dr. {{doctor.name}} has been rescheduled.</p>
                        
                        {{#if old_date}}
                        <div style="background: #fee2e2; padding: 10px; border-radius: 8px; margin: 15px 0;">
                            <p style="margin: 5px 0; text-decoration: line-through; color: #666; font-size: 14px;"><strong>Previous:</strong> {{old_date}} at {{old_time}}</p>
                        </div>
                        {{/if}}
                        
                        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 15px 0;">
                            <p style="margin: 5px 0;"><strong>New Date:</strong> {{appointment.date}}</p>
                            <p style="margin: 5px 0;"><strong>New Time:</strong> {{appointment.time}}</p>
                            <p style="margin: 5px 0;"><strong>Service:</strong> {{service.name}}</p>
                        </div>
                        
                        {{#if video_link}}
                        <p style="margin-top: 20px;">
                            <a href="{{video_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Join Video Meeting
                            </a>
                        </p>
                        {{/if}}
                        
                        <div style="margin-top: 30px;">
                            <p><a href="{{cancel_link}}" style="color: #dc2626; text-decoration: none;">Cancel Appointment</a></p>
                        </div>
                    </div>
                `,
                bodyText: `Appointment Rescheduled\n\nHello {{patient.name}},\n\nYour appointment with Dr. {{doctor.name}} has been rescheduled.\n\nNew Date: {{appointment.date}}\nNew Time: {{appointment.time}}\nService: {{service.name}}\n\nCancel: {{cancel_link}}\n{{#if video_link}}Join Video: {{video_link}}\n{{/if}}`,
                variables: ['patient.name', 'doctor.name', 'appointment.date', 'appointment.time', 'service.name', 'cancel_link', 'video_link']
            },
            {
                name: 'Appointment Cancelled',
                category: 'APPOINTMENT_CANCELLED',
                isSystem: true,
                subject: 'Appointment Cancelled - {{appointment.date}}',
                bodyHasHtml: true,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #dc2626;">Appointment Cancelled</h2>
                        <p>Hello {{patient.name}},</p>
                        <p>Your appointment with Dr. {{doctor.name}} has been cancelled.</p>
                        
                        <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                            <p style="margin: 5px 0;"><strong>Date:</strong> {{appointment.date}}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> {{appointment.time}}</p>
                            {{#if cancellation_reason}}
                            <p style="margin: 5px 0;"><strong>Reason:</strong> {{cancellation_reason}}</p>
                            {{/if}}
                        </div>
                        
                        <p>We're sorry for any inconvenience. You can book a new appointment anytime.</p>
                        
                        <p style="margin-top: 20px;">
                            <a href="{{rebook_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Book New Appointment
                            </a>
                        </p>
                    </div>
                `,
                bodyText: `Appointment Cancelled\n\nHello {{patient.name}},\n\nYour appointment with Dr. {{doctor.name}} has been cancelled.\n\nDate: {{appointment.date}}\nTime: {{appointment.time}}\n{{#if cancellation_reason}}\nReason: {{cancellation_reason}}\n{{/if}}\n\nBook New Appointment: {{rebook_link}}`,
                variables: ['patient.name', 'doctor.name', 'appointment.date', 'appointment.time', 'cancellation_reason', 'rebook_link']
            },
            {
                name: 'Video Meeting Invitation',
                category: 'VIDEO_MEETING_INVITATION',
                isSystem: true,
                subject: 'Video Meeting Starting Soon - {{appointment.time}}',
                bodyHasHtml: true,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #2563eb;">Video Meeting Invitation 📹</h2>
                        <p>Hello {{patient.name}},</p>
                        <p>Your video appointment with Dr. {{doctor.name}} is starting soon.</p>
                        
                        <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                            <p style="margin: 5px 0;"><strong>Date:</strong> {{appointment.date}}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> {{appointment.time}}</p>
                            {{#if meeting_id}}
                            <p style="margin: 5px 0;"><strong>Meeting ID:</strong> {{meeting_id}}</p>
                            {{/if}}
                        </div>
                        
                        <p style="margin-top: 30px; text-align: center;">
                            <a href="{{video_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                                Join Video Meeting Now
                            </a>
                        </p>
                        
                        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-radius: 6px;">
                            <p style="margin: 0; font-size: 14px;"><strong>Tips for a smooth meeting:</strong></p>
                            <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px;">
                                <li>Test your camera and microphone</li>
                                <li>Find a quiet, well-lit location</li>
                                <li>Join a few minutes early</li>
                            </ul>
                        </div>
                        
                        <div style="margin-top: 20px;">
                            <p style="font-size: 14px;"><a href="{{cancel_link}}" style="color: #dc2626; text-decoration: none;">Cancel Appointment</a></p>
                        </div>
                    </div>
                `,
                bodyText: `Video Meeting Invitation\n\nHello {{patient.name}},\n\nYour video appointment with Dr. {{doctor.name}} is starting soon.\n\nDate: {{appointment.date}}\nTime: {{appointment.time}}\n{{#if meeting_id}}\nMeeting ID: {{meeting_id}}\n{{/if}}\n\nJoin Video Meeting: {{video_link}}\n\nCancel: {{cancel_link}}`,
                variables: ['patient.name', 'doctor.name', 'appointment.date', 'appointment.time', 'video_link', 'meeting_id', 'cancel_link']
            },
            {
                name: 'Follow-up Request',
                category: 'FOLLOW_UP_REQUEST',
                isSystem: true,
                subject: 'How was your appointment with Dr. {{doctor.name}}?',
                bodyHasHtml: true,
                bodyHtml: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #16a34a;">Thank You for Visiting! 💚</h2>
                        <p>Hello {{patient.name}},</p>
                        <p>We hope your appointment with Dr. {{doctor.name}} on {{appointment.date}} went well.</p>
                        
                        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;">Your feedback helps us improve our service. Would you mind taking a moment to share your experience?</p>
                        </div>
                        
                        <p style="margin-top: 20px; text-align: center;">
                            <a href="{{feedback_link}}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Share Your Feedback
                            </a>
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p>Need another appointment?</p>
                            <p>
                                <a href="{{rebook_link}}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                    Book Another Appointment
                                </a>
                            </p>
                        </div>
                    </div>
                `,
                bodyText: `Thank You for Visiting!\n\nHello {{patient.name}},\n\nWe hope your appointment with Dr. {{doctor.name}} on {{appointment.date}} went well.\n\nYour feedback helps us improve. Please share your experience:\n{{feedback_link}}\n\nNeed another appointment?\n{{rebook_link}}`,
                variables: ['patient.name', 'doctor.name', 'appointment.date', 'feedback_link', 'rebook_link']
            }
        ];

        for (const template of templates) {
            try {
                await this.prisma.emailTemplate.upsert({
                    where: {
                        category_clinicId: {
                            category: template.category,
                            clinicId: (clinicId || null) as any
                        }
                    },
                    update: { isSystem: true }, // Ensure isSystem is set on update
                    create: {
                        ...template,
                        ...(clinicId ? { clinicId } : {})
                    }
                });
                console.log(`[EmailTemplates] Seeded template: ${template.name}`);
            } catch (error) {
                console.error(`[EmailTemplates] Failed to seed template ${template.name}:`, error);
            }
        }

        console.log('[EmailTemplates] System templates seeded successfully');
    }
}
