import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsGateway } from './appointments.gateway';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ROLES } from '../shared/constants/roles.constant';


import { DailyService } from '../services/daily.service';
import { ZoomService } from '../services/zoom.service';
import { GoogleMeetService } from '../services/google-meet.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { WorkflowOrchestrator } from '../workflow/workflow.orchestrator';
import { ConversationsService } from '../conversations/conversations.service';
import { TimezoneUtils } from '../shared/utils';


import { EmailTokensService } from '../services/email-tokens.service';
import { WaitlistService } from './waitlist.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private appointmentsGateway: AppointmentsGateway,
    private dailyService: DailyService,
    private zoomService: ZoomService,
    private googleMeetService: GoogleMeetService,
    private mailerService: DynamicMailerService,
    private workflowOrchestrator: WorkflowOrchestrator,
    private conversationsService: ConversationsService,
    private emailTokensService: EmailTokensService,
    private waitlistService: WaitlistService
  ) { }

  async create(createAppointmentDto: any) {
    this.logger.debug('=== CREATE APPOINTMENT DEBUG (Full Payload) ===');
    this.logger.debug(JSON.stringify(createAppointmentDto, null, 2));

    const transactionResult = await this.prisma.$transaction(async (tx) => {


      try {
        this.logger.debug('=== CREATE APPOINTMENT DEBUG (Timezone-Aware) ===');
        this.logger.debug(`Received payload: ${JSON.stringify(createAppointmentDto, null, 2)}`);

        // Destructure potential fields from both Wizard and Schedule payloads
        let {
          location, service, provider, // Wizard nested objects
          clinicId, serviceId, doctorId, // Schedule/Direct IDs
          date, time, startTime, endTime, // Date/Time variants
          patientDetails, patientId, // Patient info
          type, notes,
          guestName, guestEmail, guestPhone, // Guest info direct
          password, // Patient Password from Payload
          formId,
          status, // NEW: Support status override
          priority, waitlistAddedAt, waitlistReason, // NEW: Waitlist metadata
          recurringFreq, recurringUntil, recurringGroupId, rescheduleFuture // NEW: Recurring fields
        } = createAppointmentDto;

        // ... [Retain lines 59-250 unchanged, assume apply will handle context if I target correctly]
        // But I need to apply changes in multiple chunks or carefully.
        // Actually, let's just use MultiReplace or Replace with enough context.
        // I'll skip the middle part unless forced.

        // Block 1: Destructuring 
        // I will do huge chunk or separate? 
        // Let's do separate chunks.

        // Resolve IDs
        const finalClinicId = location?.id || clinicId;
        const finalServiceId = service?.id || serviceId;
        const finalDoctorId = provider?.id || doctorId;

        console.log('Resolved IDs:', { finalClinicId, finalServiceId, finalDoctorId });

        if (!finalDoctorId) {
          throw new Error("Doctor ID is required");
        }

        let clinicName = '';
        let doctorName = '';
        let serviceName = '';

        // TIMEZONE-AWARE: Fetch doctor to get timezone (Single Source of Truth)
        let timezone = 'America/New_York'; // Default fallback

        // Fetch doctor to get timezone
        const doctorUser = await tx.user.findUnique({
          where: { id: finalDoctorId }
        });

        if (doctorUser) {
          timezone = doctorUser.timezone || timezone;
          doctorName = doctorUser.name;
        }

        if (finalClinicId) {
          // Fetch clinic for name and fallback timezone
          const clinic = await tx.clinic.findUnique({
            where: { id: finalClinicId }
          });
          if (clinic) {
            clinicName = clinic.name;
            if (!doctorUser?.timezone && clinic.timezone) {
              timezone = clinic.timezone;
            }
          }
        }

        if (finalServiceId) {
          const serviceObj = await tx.service.findUnique({
            where: { id: finalServiceId }
          });
          if (serviceObj) {
            serviceName = serviceObj.name;
          }
        }

        console.log('Using timezone:', timezone);

        // TIMEZONE-AWARE: Parse and convert dates to UTC
        let appointmentDateUTC: Date;
        let appointmentEndTimeUTC: Date | undefined;
        let appointmentNotes = notes;

        // Determine duration early
        let duration = 30; // Default
        if (service) {
          duration = parseInt(service.duration) || 30;
        } else if (finalServiceId) {
          const serviceRecord = await tx.service.findUnique({
            where: { id: finalServiceId }
          });
          if (serviceRecord) {
            duration = parseInt(serviceRecord.duration) || 30;
          }
        }

        if (startTime) {
          // startTime is already an ISO string (absolute UTC), use it directly
          appointmentDateUTC = new Date(startTime);

          if (endTime) {
            appointmentEndTimeUTC = new Date(endTime);
          } else {
            appointmentEndTimeUTC = TimezoneUtils.addMinutes(appointmentDateUTC, duration);
          }
        } else if (date && time) {
          // Parse date and time in clinic timezone
          appointmentDateUTC = TimezoneUtils.parseDateTime(date, time, timezone);
          appointmentEndTimeUTC = TimezoneUtils.addMinutes(appointmentDateUTC, duration);
        } else if (date) {
          // Date only, no time - assume start of day
          const localDate = new Date(date);
          appointmentDateUTC = TimezoneUtils.toUTC(localDate, timezone);
          appointmentEndTimeUTC = TimezoneUtils.addMinutes(appointmentDateUTC, duration);
        } else {
          throw new Error("Date/Start Time is required");
        }

        console.log('Parsed dates (UTC):', {
          appointmentDateUTC: appointmentDateUTC.toISOString(),
          appointmentEndTimeUTC: appointmentEndTimeUTC?.toISOString(),
          timezone,
          duration
        });

        // Resolve Patient
        let finalPatientId = patientId;

        // Determine effective details (prioritize patientDetails, fallback to guest)
        const effectiveEmail = patientDetails?.email || guestEmail;
        const effectiveName = patientDetails?.fullName || guestName;
        const effectivePhone = patientDetails?.phone || guestPhone;

        // DEBUG: Log password field
        console.log('=== PATIENT ACCOUNT CREATION DEBUG ===');
        console.log(`Password field received: ${password ? '[PROVIDED]' : '[NOT PROVIDED]'}`);
        console.log(`Effective email: ${effectiveEmail}`);
        console.log(`Effective name: ${effectiveName}`);
        console.log('======================================');

        // If email is provided, we prioritize resolving by email to avoid stale IDs
        if (effectiveEmail) {
          const lowerEmail = effectiveEmail.toLowerCase();

          // 1. Find or Create Patient
          let patient = await tx.patient.findFirst({
            where: { email: { equals: lowerEmail, mode: 'insensitive' } }
          });

          console.log(`Existing patient found: ${patient ? 'YES (id: ' + patient.id + ')' : 'NO'}`);

          if (!patient && effectiveName) {
            console.log(`Creating new Patient record with ${password ? 'password hash' : 'NO password'}`);
            patient = await tx.patient.create({
              data: {
                name: effectiveName,
                email: lowerEmail,
                phone: effectivePhone,
                passwordHash: password ? await bcrypt.hash(password, 10) : undefined
              }
            });
            console.log(`✅ Patient created: ${patient.id}`);
          }

          if (patient) {
            finalPatientId = patient.id;
          }

          // 2. Auto-create User account for authentication
          const existingUser = await tx.user.findFirst({
            where: { email: { equals: lowerEmail, mode: 'insensitive' } }
          });

          console.log(`Existing User account found: ${existingUser ? 'YES (id: ' + existingUser.id + ', role: ' + existingUser.role + ')' : 'NO'}`);

          // ALWAYS create user if doesn't exist (generate password if not provided)
          if (!existingUser) {
            console.log(`🔐 Auto-creating User account for patient: ${lowerEmail}`);
            const userPassword = password || Math.random().toString(36).slice(-8);
            const sendWelcomeEmail = !!password; // Only send email if password was provided

            console.log(`User password: ${password ? '[USER PROVIDED]' : '[AUTO-GENERATED]'}`);
            console.log(`Will send welcome email: ${sendWelcomeEmail}`);

            try {
              const newUser = await tx.user.create({
                data: {
                  name: effectiveName || 'Patient',
                  email: lowerEmail,
                  role: 'patient',
                  passwordHash: await bcrypt.hash(userPassword, 10),
                  timezone: timezone || 'America/New_York'
                }
              });
              console.log(`✅ User account created successfully: ${newUser.id}`);

              // Send Welcome Email ONLY if password was provided by user
              if (sendWelcomeEmail) {
                const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                try {
                  await this.mailerService.sendMail(undefined, {
                    to: lowerEmail,
                    subject: 'Welcome to MediFlow - Your Account Credentials',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Welcome to MediFlow!</h2>
                            <p>An account has been created for you to manage your appointments.</p>
                            <p><strong>Email:</strong> ${lowerEmail}</p>
                            <p><strong>Password:</strong> ${userPassword}</p>
                            <a href="${appUrl}/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Log In</a>
                            <p>We recommend changing your password after your first login.</p>
                        </div>
                    `
                  });
                  console.log(`✅ Welcome email sent to ${lowerEmail}`);
                } catch (emailError) {
                  console.error('❌ Failed to send welcome email:', emailError);
                  // Don't fail transaction if email fails
                }
              } else {
                console.log(`ℹ️  User created with auto-generated password (no email sent)`);
              }
            } catch (userCreateError) {
              console.error('❌ CRITICAL: Failed to create User account:', userCreateError);
              throw userCreateError; // Re-throw to fail the transaction
            }
          } else {
            console.log(`ℹ️  User account already exists, skipping creation`);
          }
        } else {
          console.log('⚠️  No email provided, skipping Patient/User account creation');
        }

        console.log('Final patient ID:', finalPatientId);

        // TIMEZONE-AWARE DOUBLE BOOKING CHECK
        // Get day bounds in UTC for the appointment date
        const { start: dayStartUTC, end: dayEndUTC } = TimezoneUtils.getDayBoundsInUTC(
          appointmentDateUTC,
          timezone
        );

        console.log('Checking conflicts for day:', {
          dayStartUTC: dayStartUTC.toISOString(),
          dayEndUTC: dayEndUTC.toISOString()
        });

        // Fetch all appointments for this doctor on this day (in UTC)
        const dayAppointments = await tx.appointment.findMany({
          where: {
            doctorId: finalDoctorId,
            date: {
              gte: dayStartUTC,
              lt: dayEndUTC
            },
            status: { notIn: ['cancelled', 'waitlist'] }
          },
          include: { service: true }
        });

        console.log(`Found ${dayAppointments.length} existing appointments for the day`);

        // Check for overlaps
        const hasOverlap = dayAppointments.some(appt => {
          const apptStart = new Date(appt.date);
          const apptDuration = appt.service ? (parseInt(appt.service.duration) || 30) : 30;
          const apptEnd = TimezoneUtils.addMinutes(apptStart, apptDuration);

          const isOverlapping = TimezoneUtils.hasOverlap(
            appointmentDateUTC,
            appointmentEndTimeUTC,
            apptStart,
            apptEnd
          );

          if (isOverlapping) {
            console.log('Overlap detected with appointment:', {
              existingId: appt.id,
              existingStart: apptStart.toISOString(),
              existingEnd: apptEnd.toISOString(),
              newStart: appointmentDateUTC.toISOString(),
              newEnd: appointmentEndTimeUTC.toISOString()
            });
          }

          return isOverlapping;
        });

        if (hasOverlap && status !== 'waitlist') {
          throw new Error("This time slot is already booked. Please choose a different time.");
        }

        console.log('No conflicts found, creating appointment...');

        const finalRecurringGroupId = recurringGroupId || (recurringFreq && recurringFreq !== 'NONE' ? uuidv4() : null);
        const recurringDates: Date[] = [appointmentDateUTC];

        if (recurringFreq && recurringFreq !== 'NONE' && recurringUntil) {
          const until = new Date(recurringUntil);
          let nextDate = new Date(appointmentDateUTC);

          while (true) {
            if (recurringFreq === 'DAILY') {
              nextDate = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
            } else if (recurringFreq === 'WEEKLY') {
              nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else if (recurringFreq === 'MONTHLY') {
              nextDate = new Date(nextDate);
              nextDate.setMonth(nextDate.getMonth() + 1);
            } else {
              break;
            }

            if (nextDate > until) break;
            // Limit to 52 instances to prevent infinite loops/abuse
            if (recurringDates.length >= 52) break;

            recurringDates.push(new Date(nextDate));
          }
        }

        const createdAppointments: any[] = [];
        for (const dateInstance of recurringDates) {
          const createData = {
            clinicId: finalClinicId || null,
            serviceId: finalServiceId || null,
            doctorId: finalDoctorId,
            date: dateInstance,
            notes: appointmentNotes,
            guestName: guestName || patientDetails?.fullName,
            guestEmail: guestEmail || patientDetails?.email,
            guestPhone: guestPhone || patientDetails?.phone,
            status: status || 'scheduled',
            type: type || (service?.type === 'Telehealth' ? 'video' : 'in-person'),
            patientId: finalPatientId || null,
            priority: priority ? parseInt(priority) : undefined,
            waitlistAddedAt: waitlistAddedAt ? new Date(waitlistAddedAt) : undefined,
            waitlistReason: waitlistReason,
            recurringFreq: recurringFreq || 'NONE',
            recurringUntil: recurringUntil ? new Date(recurringUntil) : null,
            recurringGroupId: finalRecurringGroupId
          };

          const created = await tx.appointment.create({ data: createData });
          createdAppointments.push(created);
        }

        const result = createdAppointments[0];
        console.log(`Created ${createdAppointments.length} appointments. Group: ${finalRecurringGroupId}`);

        // Handle Communication Data Preparation (Inside TX to read patient safely)
        const isVirtual = result.type === 'video' || result.type === 'Virtual';

        return {
          result,
          finalPatientId,
          patientDetails,
          guestName,
          guestEmail,
          guestPhone,
          isVirtual,
          time,
          appointmentDateLocal: TimezoneUtils.toClinicTime(appointmentDateUTC, timezone),
          appointmentDateUTC, // EXPOSED
          timezone, // EXPOSED
          finalDoctorId, // Return doctor ID for context
          formId,
          clinicName, // EXPOSED
          doctorName, // EXPOSED
          serviceName // EXPOSED
        };
      } catch (error) {
        console.error('=== APPOINTMENT CREATION ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        throw error;
      }
    }, {
      isolationLevel: 'Serializable', // Prevent concurrent double bookings
      maxWait: 5000, // Wait up to 5 seconds for transaction lock
      timeout: 10000 // Transaction timeout
    });

    // === POST-TRANSACTION SIDE EFFECTS ===
    const { result, finalPatientId, patientDetails, guestName, guestEmail, guestPhone, isVirtual, time, appointmentDateLocal, finalDoctorId, appointmentDateUTC, timezone, formId, clinicName, doctorName, serviceName } = transactionResult;

    // 1. Generate Meeting Link (if virtual)
    let meetingLink = '';
    if (isVirtual && (patientDetails?.email)) {
      try {
        // Ensure meeting exists (idempotent)
        const { url } = await this.getMeetingUrl(result.id);
        // Use direct provider URL (Google Meet / Zoom / Daily) instead of internal wrapper
        meetingLink = url;
      } catch (e) {
        console.error('Failed to generate meeting link', e);
      }
    }

    // 2. Prepare Context
    // Construct context safely handling both guest and patient scenarios
    let contextName = patientDetails?.fullName || guestName || 'Patient';
    let contextEmail = patientDetails?.email || guestEmail;
    let contextPhone = patientDetails?.phone || guestPhone;

    // If we have a patient ID but missing details in payload, fetch from DB now (outside TX is fine, or assumes existing)
    if (finalPatientId && (!contextEmail || !contextPhone)) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: finalPatientId }
      });
      if (patient) {
        contextName = contextName === 'Patient' ? patient.name : contextName;
        contextEmail = contextEmail || patient.email;
        contextPhone = contextPhone || patient.phone;
      }
    }

    // Fetch clinic data for conditional location rendering
    let clinicAddress = '';
    let mapLink = '';
    let mapPin = '';

    if (result.clinicId) {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: result.clinicId }
      });

      if (clinic) {
        clinicAddress = clinic.address || '';

        // Generate map link and static map image if coordinates exist
        if (clinic.latitude && clinic.longitude) {
          mapLink = `https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`;

          // Only generate static map if API key is configured
          if (process.env.GOOGLE_MAPS_API_KEY) {
            mapPin = `https://maps.googleapis.com/maps/api/staticmap?center=${clinic.latitude},${clinic.longitude}&zoom=15&size=600x300&markers=color:red%7C${clinic.latitude},${clinic.longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
          }
        }
      }
    }

    // 1.5 Generate Intake Magic Link (if active intake form exists)
    let intakeLink = '';
    const activeIntakeForm = await this.prisma.form.findFirst({
      where: { systemType: 'INTAKE', status: 'published' },
      orderBy: { isActive: 'desc' }
    });

    const formConfig = activeIntakeForm?.config as any;
    if (activeIntakeForm && formConfig?.includeInEmail !== false) {
      try {
        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.intakeSession.create({
          data: {
            token,
            patientId: finalPatientId,
            appointmentId: result.id,
            expiresAt,
            status: 'PENDING'
          }
        });

        intakeLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/public/intake/${token}`;
      } catch (e) {
        console.error('Failed to generate intake session', e);
      }
    }

    const context = {
      // Use the clinic/doctor timezone directly for formatting
      formattedDate: appointmentDateUTC.toLocaleDateString('en-US', { timeZone: timezone }),
      formattedTime: appointmentDateUTC.toLocaleTimeString('en-US', { timeZone: timezone }),

      patientId: finalPatientId || undefined,
      appointmentId: result.id,
      doctorId: finalDoctorId,
      clinicId: result.clinicId, // CRITICAL: Pass clinicId for workflow filtering
      patientName: contextName,
      name: contextName,
      email: contextEmail,
      patientEmail: contextEmail,
      phone: contextPhone,
      patientPhone: contextPhone,

      // Conditional: Meeting link (online appointments only)
      meetingLink: meetingLink,
      video_link: meetingLink, // Handlebars alias
      intake_link: intakeLink, // Intake magic link

      // Conditional: Physical location (in-person appointments only)
      appointmentType: result.type, // 'video' or 'in-person'
      clinicAddress: clinicAddress,
      mapLink: mapLink,
      mapPin: mapPin,

      // Nested Context for Handlebars ({{patient.name}}, etc.)
      patient: {
        name: contextName,
        email: contextEmail,
        phone: contextPhone,
      },
      doctor: {
        name: doctorName,
      },
      appointment: {
        date: appointmentDateUTC.toLocaleDateString('en-US', { timeZone: timezone }),
        time: time || appointmentDateUTC.toLocaleTimeString('en-US', { timeZone: timezone }),
        type: result.type,
      },
      service: {
        name: serviceName,
      },

      // Generate Action Tokens
      confirmLink: `${process.env.API_URL || 'http://localhost:4000'}/email/confirm?token=${await this.emailTokensService.generateToken(result.id, 'CONFIRM')}`,
      cancelLink: `${process.env.API_URL || 'http://localhost:4000'}/email/cancel?token=${await this.emailTokensService.generateToken(result.id, 'CANCEL')}`,
      rescheduleLink: `${process.env.API_URL || 'http://localhost:4000'}/email/reschedule?token=${await this.emailTokensService.generateToken(result.id, 'RESCHEDULE')}`,

      openTrackLink: `${process.env.API_URL || 'http://localhost:4000'}/email/open?token=${result.id}`, // Simple open tracking using ID

      // Calendar Links (Signed)
      calendarLink_google: `${process.env.API_URL || 'http://localhost:4000'}/email/calendar?type=google&token=${await this.emailTokensService.generateToken(result.id, 'CALENDAR', 24 * 7)}`,
      calendarLink_outlook: `${process.env.API_URL || 'http://localhost:4000'}/email/calendar?type=outlook&token=${await this.emailTokensService.generateToken(result.id, 'CALENDAR', 24 * 7)}`,
      calendarLink_ics: `${process.env.API_URL || 'http://localhost:4000'}/email/calendar?type=ics&token=${await this.emailTokensService.generateToken(result.id, 'CALENDAR', 24 * 7)}`,

      // ISO string is always UTC

      // ISO string is always UTC
      appointmentDate: appointmentDateUTC.toISOString(),

      // Formatted strings with explicit timezone
      appointmentTime: appointmentDateUTC.toLocaleTimeString('en-US', { timeZone: timezone }),
      appointmentDateTime: appointmentDateUTC.toLocaleString('en-US', { timeZone: timezone }),

      // Legacy fields
      fullName: contextName,
      link: meetingLink,
      date: appointmentDateUTC.toLocaleDateString('en-US', { timeZone: timezone }),
      time: time || appointmentDateUTC.toLocaleTimeString('en-US', { timeZone: timezone }),
      formId: formId,
      clinicName: clinicName, // Added clinicName here
      doctorName: doctorName,
      serviceName: serviceName
    };

    // 3. Auto-create conversation between doctor and patient
    if (finalPatientId && finalDoctorId) {
      try {
        await this.conversationsService.getOrCreateConversation(finalDoctorId, finalPatientId);
        this.logger.log(`Conversation ensured for doctor ${finalDoctorId} and patient ${finalPatientId}`);
      } catch (error) {
        this.logger.error('Failed to create conversation:', error);
        // Don't fail the appointment creation if conversation creation fails
      }
    }

    // 4. Determine patient type (NEW vs RECURRING)
    const patientType = await this.getPatientType(finalPatientId, finalDoctorId);
    this.logger.log(`Patient type detected: ${patientType}`);

    // 5. Trigger Automation (Fire and Forget) with patient type and formId
    this.workflowOrchestrator.triggerEvent('APPOINTMENT_CREATED', {
      ...context,
      patientType,
      formId
    } as any).catch(err => {
      console.error("Failed to trigger workflow", err);
    });

    // 6. Notify Gateway
    this.appointmentsGateway.notifyAppointmentUpdate();

    // 7. Log Event
    await this.logAppointmentEvent(result.id, 'CREATED', {
      method: guestEmail ? 'GUEST' : 'PATIENT_PORTAL',
      isVirtual
    });

    return result;
  }

  /**
   * Determines if a patient is NEW or RECURRING based on appointment history
   */
  private async getPatientType(patientId: string, doctorId: string): Promise<'NEW' | 'RECURRING'> {
    const previousAppointments = await this.prisma.appointment.count({
      where: {
        patientId,
        doctorId,
        status: { in: ['COMPLETED', 'CONFIRMED'] }
      }
    });

    return previousAppointments > 0 ? 'RECURRING' : 'NEW';
  }



  async findAll(params?: {
    userId?: string;
    role?: string;
    patientId?: string | null;
    doctorId?: string;
    date?: string;
    start?: string;
    end?: string;
    timezone?: string;
    clinicId?: string;
  }) {
    const { userId, patientId, doctorId, date, start, end, timezone = 'UTC' } = params || {};
    const role = params?.role?.toLowerCase();
    let paramsClinicId = params?.clinicId;
    const where: any = {};

    // CRITICAL: Enforce role-based access control (Multitenancy)

    // 0. Superuser Global Access
    if (role === 'saas_owner') {
      // Allow filtering override if passed, otherwise see all
      if (paramsClinicId) {
        where.clinicId = paramsClinicId;
      }
    }
    // 1. Clinic Admin Scoping
    else if (role === 'system_admin' || role === 'clinic_admin') {
      // Must have clinicId context
      if (!paramsClinicId) {
        // SECURITY: Prevent headless view
        this.logger.warn(`Clinic/System admin ${userId} has no clinicId context. Denying access.`);
        return [];
      } else {
        where.clinicId = paramsClinicId;
      }
    }
    // 2. Doctor Scoping
    else if (role === 'doctor') {
      // Doctor sees only their appointments
      where.doctorId = userId;
      // Optional: If they are multifacility, we *could* filter by clinicId too if passed
      if (paramsClinicId) {
        where.clinicId = paramsClinicId;
      }
    }
    // 3. Patient Scoping
    else if (role === 'patient') {
      // Patient sees only their appointments
      if (!patientId) {
        throw new Error('Patient ID required for patient role');
      }
      where.patientId = patientId;
    }
    // 4. Other Roles / Fallback
    else if (role === 'clinic_representative') {
      // Requirements state representative cannot see schedules
      throw new ForbiddenException('Representatives do not have access to schedules');
    } else if (doctorId) {
      // Fallback for public availability checks (unauthenticated but scoped to doctor)
      where.doctorId = doctorId;
    } else {
      // SECURITY BLOCK
      this.logger.warn(`Unknown/Unscoped role ${role} attempted to access appointments`);
      return [];
    }

    // Apply patient filtering if provided (and not already set by role=patient)
    if (patientId && role !== 'patient') {
      where.patientId = patientId;
    }

    if (date && date !== 'all') {
      // TIMEZONE-AWARE: Use timezone-aware day bounds
      const queryDate = new Date(date);
      const { start: dayStart, end: dayEnd } = TimezoneUtils.getDayBoundsInUTC(queryDate, timezone);

      where.date = {
        gte: dayStart,
        lte: dayEnd
      };
    } else if (start && end) {
      // TIMEZONE-AWARE: Convert range to UTC
      const startDate = new Date(start);
      const endDate = new Date(end);

      where.date = {
        gte: TimezoneUtils.toUTC(startDate, timezone),
        lte: TimezoneUtils.toUTC(endDate, timezone)
      };
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        clinic: true,
        service: true,
        doctor: true,
        patient: true
      },
      orderBy: {
        date: 'asc'
      }
    });



    // Return raw appointments with UTC dates
    // Frontend handles timezone display logic
    return appointments;
  }

  async findOne(id: string, user?: any) {
    if (user) {
      await this.verifyAccess(id, user);
    }

    return this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        service: true,
        clinic: true
      }
    });
  }

  private async verifyAccess(appointmentId: string, user: any) {
    const { role, id: userId, clinicId } = user;
    const normalizedRole = role?.toUpperCase();

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} not found`);
    }

    // Admin bypass
    if (normalizedRole === ROLES.SYSTEM_ADMIN || normalizedRole === ROLES.SAAS_OWNER) {
      return appointment;
    }

    // Clinic Scoping
    if (clinicId && appointment.clinicId && appointment.clinicId !== clinicId) {
      throw new ForbiddenException('Access denied: Appointment belongs to another clinic');
    }

    // Doctor Scoping
    if (normalizedRole === ROLES.DOCTOR && appointment.doctorId !== userId) {
      throw new ForbiddenException('Access denied: This is not your appointment');
    }

    // Patient Scoping
    if (normalizedRole === ROLES.PATIENT) {
      const patient = await this.prisma.patient.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } }
      });
      if (!patient || appointment.patientId !== patient.id) {
        throw new ForbiddenException('Access denied: You can only access your own appointments');
      }
    }

    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, user?: any) {
    if (user) {
      await this.verifyAccess(id, user);
    }

    const updateData: any = {};

    // Handle type change (in-person <-> virtual)
    if (updateAppointmentDto.type) {
      updateData.type = updateAppointmentDto.type;
    }

    // Handle date/time change (reschedule)
    if (updateAppointmentDto.date) {
      updateData.date = new Date(updateAppointmentDto.date);
    }

    // Fetched existing status for Recurring Patient Logic
    const existingAppointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: { status: true }
    });

    // Handle status change (e.g., waitlist, cancelled)
    if (updateAppointmentDto.status) {
      updateData.status = updateAppointmentDto.status;
    }

    // Handle waitlist metadata
    if (updateAppointmentDto.priority !== undefined) {
      updateData.priority = updateAppointmentDto.priority;
    }
    if (updateAppointmentDto.waitlistAddedAt) {
      updateData.waitlistAddedAt = new Date(updateAppointmentDto.waitlistAddedAt);
    }
    if (updateAppointmentDto.waitlistReason !== undefined) {
      updateData.waitlistReason = updateAppointmentDto.waitlistReason;
    }

    // Handle notes update
    if (updateAppointmentDto.notes !== undefined) {
      updateData.notes = updateAppointmentDto.notes;
    }

    const result = await this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: true,
        doctor: true,
        service: true,
        clinic: true
      }
    });

    // Handle rescheduling for future instances if requested
    if (updateAppointmentDto.rescheduleFuture && result.recurringGroupId && updateAppointmentDto.date) {
      const oldAppointment = await this.prisma.appointment.findUnique({ where: { id } });
      const timeDiff = new Date(updateAppointmentDto.date).getTime() - new Date(oldAppointment!.date).getTime();

      const futureInstances = await this.prisma.appointment.findMany({
        where: {
          recurringGroupId: result.recurringGroupId,
          date: { gt: oldAppointment!.date },
          id: { not: id },
          status: { notIn: ['cancelled', 'completed'] }
        }
      });

      for (const instance of futureInstances) {
        const newDate = new Date(new Date(instance.date).getTime() + timeDiff);
        await this.prisma.appointment.update({
          where: { id: instance.id },
          data: {
            date: newDate,
            status: updateData.status // Propagate status change too? User said "reschedule for all", so dates definitely.
          }
        });
      }
    }


    this.appointmentsGateway.notifyAppointmentUpdate();

    // WORKFLOW TRIGGERS
    try {
      const context = {
        appointmentId: result.id,
        patientId: result.patientId,
        doctorId: result.doctorId,
        clinicId: result.clinicId, // CRITICAL: Pass clinicId for workflow filtering
        // Add more context as needed
        status: result.status,
        date: result.date,
        doctorName: result.doctor?.name,
        patientName: result.patient?.name,
        email: result.patient?.email,
        phone: result.patient?.phone
      };

      if (updateAppointmentDto.status === 'cancelled') {
        this.workflowOrchestrator.triggerEvent('APPOINTMENT_CANCELLED', context as any);
      } else if (updateAppointmentDto.date) {
        this.workflowOrchestrator.triggerEvent('APPOINTMENT_RESCHEDULED', context as any);
      }
    } catch (e) {
      this.logger.error(`Failed to trigger workflow event: ${e.message}`);
    }

    // RECURRING PATIENT INTELLIGENCE
    if (updateAppointmentDto.status === 'completed' && existingAppointment?.status !== 'completed' && result.patientId) {
      await this.updatePatientStats(result.patientId);
    }

    // SMART WAITLIST AUTOMATION
    if (updateAppointmentDto.status === 'cancelled' && existingAppointment?.status !== 'cancelled') {
      // Fire and Forget (don't block response)
      this.waitlistService.processCancellation(result.id).catch(err =>
        this.logger.error(`Failed to process waitlist for cancelled appointment: ${err.message}`)
      );
    }

    // LOGGING
    const changes: Record<string, any> = {};
    if (updateAppointmentDto.status && updateAppointmentDto.status !== existingAppointment?.status) changes.status = updateAppointmentDto.status;
    if (updateAppointmentDto.date) changes.rescheduled = true;
    if (updateAppointmentDto.type) changes.type = updateAppointmentDto.type;

    if (Object.keys(changes).length > 0) {
      const action = changes.status === 'cancelled' ? 'CANCELLED'
        : changes.rescheduled ? 'RESCHEDULED'
          : 'UPDATED';

      await this.logAppointmentEvent(result.id, action, changes);
    }

    return result;
  }

  /**
   * Logs an appointment lifecycle event
   */
  private async logAppointmentEvent(appointmentId: string, action: string, metadata?: any) {
    try {
      await this.prisma.appointmentLog.create({
        data: {
          appointmentId,
          action,
          metadata: metadata || {}
        }
      });
    } catch (e) {
      this.logger.error(`Failed to log event ${action} for appointment ${appointmentId}`, e);
    }
  }

  /**
   * Updates patient stats (completed count, tags)
   */
  private async updatePatientStats(patientId: string) {
    try {
      // 1. Get count of completed appointments
      const completedCount = await this.prisma.appointment.count({
        where: {
          patientId,
          status: 'completed'
        }
      });

      // 2. Fetch current tags
      const patient = await this.prisma.patient.findUnique({
        where: { id: patientId },
        select: { tags: true }
      });

      const tags = patient?.tags || [];
      const isRecurring = completedCount > 1;
      let newTags = [...tags];

      // Add 'recurring_patient' if applicable and missing
      if (isRecurring && !newTags.includes('recurring_patient')) {
        newTags.push('recurring_patient');
      }

      // 3. Update Patient
      await this.prisma.patient.update({
        where: { id: patientId },
        data: {
          completedAppts: completedCount,
          tags: newTags
        }
      });

      this.logger.log(`Updated stats for patient ${patientId}: ${completedCount} completed, tags: ${newTags.join(', ')}`);
    } catch (e) {
      this.logger.error(`Failed to update patient stats for ${patientId}`, e);
    }
  }

  async remove(id: string, user?: any) {
    if (user) {
      await this.verifyAccess(id, user);
    }

    const result = await this.prisma.appointment.delete({
      where: { id }
    });
    this.appointmentsGateway.notifyAppointmentUpdate();
    return result;
  }

  async getWaitlistAppointments(user?: any) {
    const where: any = { status: 'waitlist' };
    if (user?.clinicId && user?.role?.toUpperCase() !== ROLES.SAAS_OWNER) {
      where.clinicId = user.clinicId;
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
        service: true,
        clinic: true
      },
      orderBy: [
        { priority: 'asc' },
        { waitlistAddedAt: 'asc' }
      ]
    });
  }

  async moveToActiveSchedule(id: string, newDate: Date, user?: any) {
    if (user) {
      await this.verifyAccess(id, user);
    }

    const result = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'scheduled',
        date: newDate,
        priority: null,
        waitlistAddedAt: null,
        waitlistReason: null
      },
      include: {
        patient: true,
        doctor: true,
        service: true,
        clinic: true
      }
    });

    this.appointmentsGateway.notifyAppointmentUpdate();
    return result;
  }

  async updateWaitlistPriority(id: string, priority: number, user?: any) {
    if (user) {
      await this.verifyAccess(id, user);
    }

    const result = await this.prisma.appointment.update({
      where: { id },
      data: { priority },
      include: {
        patient: true,
        doctor: true,
        service: true,
        clinic: true
      }
    });

    this.appointmentsGateway.notifyAppointmentUpdate();
    return result;
  }

  async getWaitlistCount(user?: any) {
    const where: any = { status: 'waitlist' };
    if (user?.clinicId && user?.role?.toUpperCase() !== ROLES.SAAS_OWNER) {
      where.clinicId = user.clinicId;
    }
    return this.prisma.appointment.count({
      where
    });
  }

  async getMeetingUrl(appointmentId: string, user?: any) {
    // 1. Check if appointment exists and get doctor info
    if (user) {
      await this.verifyAccess(appointmentId, user);
    }

    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true }
    });

    if (!appt) {
      throw new Error('Appointment not found');
    }

    // 2. Get provider from doctor's settings (default to Daily.co)
    const provider = appt.doctor.videoProvider || 'daily';

    // 3. Create meeting based on provider
    switch (provider) {
      case 'zoom':
        try {
          return await this.zoomService.createMeeting(appointmentId, appt.doctorId);
        } catch (error) {
          this.logger.error(`Zoom meeting creation failed, falling back to Daily.co: ${error.message} `);
          // Fallback to Daily.co if Zoom fails
          const roomName = `appt-${appointmentId}`;
          const url = await this.dailyService.createRoom(roomName);
          return { url, provider: 'daily' };
        }

      case 'google-meet':
        try {
          return await this.googleMeetService.createMeeting(
            appointmentId,
            appt.doctorId,
            appt.date,
            60 // Default 60 minutes duration
          );
        } catch (error) {
          this.logger.error(`Google Meet creation failed, falling back to Daily.co: ${error.message} `);
          // Fallback to Daily.co if Google Meet fails
          const roomName = `appt-${appointmentId}`;
          const url = await this.dailyService.createRoom(roomName);
          return { url, provider: 'daily' };
        }

      case 'daily':
      default:
        // Daily.co (default)
        const roomName = `appt-${appointmentId}`;
        const url = await this.dailyService.createRoom(roomName);
        return { url, provider: 'daily' };
    }
  }

  /**
   * Get available time slots for a doctor on a specific date
   * Filters by appointment type and excludes already booked slots
   */
  async getAvailableSlots(params: {
    doctorId: string;
    date: string;
    type?: 'online' | 'in-person';
    excludeId?: string;
    timezone?: string;
  }) {
    const { doctorId, date, type, excludeId, timezone = 'UTC' } = params;

    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
      select: { schedule: true, breakTime: true, timezone: true }
    });

    // Use doctor's timezone as the definitive source properly
    const activeTimezone = doctor?.timezone || timezone || 'America/New_York';

    if (!doctor || !doctor.schedule) {
      return { slots: [], allSlots: [] };
    }

    // 2. Parse doctor's schedule for the requested day
    // Parse date in the TARGET timezone to correctly identify the day of week (Mon, Tue, etc.)
    const queryDate = TimezoneUtils.parseDate(date, activeTimezone); // Returns UTC timestamp representing midnight in target TZ
    // Use queryDate (which is already the correct UTC instant for the start of the day in that TZ)
    // and format it asking for the weekday in that specific TZ.
    const dayName = queryDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: activeTimezone });

    const schedule = doctor.schedule as any;
    const activeSchedule = (schedule && !Array.isArray(schedule) && schedule.days)
      ? schedule.days
      : (Array.isArray(schedule) ? schedule : []);

    const daySchedule = activeSchedule.find((d: any) => d.day === dayName && d.active);

    if (!daySchedule) {
      return { slots: [], allSlots: [] };
    }

    // 3. Generate all possible slots based on schedule
    const allSlots: Array<{
      time: string;
      type: 'online' | 'in-person' | 'both';
      available: boolean;
    }> = [];

    // If day has specific time slots, use those
    if (daySchedule.slots && daySchedule.slots.length > 0) {
      daySchedule.slots.forEach((slot: any) => {
        const slots = this.generateSlotsForRange(
          slot.start,
          slot.end,
          Math.max(15, Number(schedule.slotDuration) || 30), // Dynamic interval
          slot.type || daySchedule.type
        );
        allSlots.push(...slots);
      });
    } else if (daySchedule.start && daySchedule.end) {
      // Use day-level start/end times
      const slots = this.generateSlotsForRange(
        daySchedule.start,
        daySchedule.end,
        Math.max(15, Number(schedule.slotDuration) || 30), // Dynamic interval
        daySchedule.type
      );
      allSlots.push(...slots);
    }

    // 4. Get existing appointments for the day
    // IMPORTANT: Parse the date string as if it's in the clinic's timezone
    // "2026-01-12" should mean Jan 12 in America/New_York, not Jan 12 in UTC
    const { start: dayStart, end: dayEnd } = TimezoneUtils.getDayBoundsInUTC(
      TimezoneUtils.parseDate(date, activeTimezone),  // Parse date in doctor's timezone
      activeTimezone
    );

    this.logger.log(`[getAvailableSlots] Querying appointments for ${date} in ${activeTimezone}: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);

    const [existingAppointments, existingMeetings] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          doctorId,
          date: { gte: dayStart, lt: dayEnd },
          status: { notIn: ['cancelled', 'waitlist'] },
          id: excludeId ? { not: excludeId } : undefined
        },
        include: { service: true }
      }),
      this.prisma.meeting.findMany({
        where: {
          createdBy: doctorId,
          startTime: { gte: dayStart, lt: dayEnd },
          status: { notIn: ['CANCELLED'] }
        }
      })
    ]);

    // 5. Build map of booked slots by time and type
    const bookedSlots = new Map<string, Set<'online' | 'in-person'>>();

    existingAppointments.forEach(appt => {
      // Use robust formatting to get time in target timezone
      const timeStr = appt.date.toLocaleTimeString('en-GB', {
        timeZone: activeTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const apptType = appt.type === 'video' ? 'online' : 'in-person';

      this.logger.log(`[getAvailableSlots] Booking slot: ${timeStr} (${apptType}) from appointment ${appt.id} at ${appt.date.toISOString()}`);

      if (!bookedSlots.has(timeStr)) {
        bookedSlots.set(timeStr, new Set());
      }
      bookedSlots.get(timeStr)!.add(apptType);
    });

    this.logger.log(`[getAvailableSlots] Total booked slots: ${bookedSlots.size}, Map: ${JSON.stringify(Array.from(bookedSlots.entries()).map(([k, v]) => [k, Array.from(v)]))}`);

    // 6. Mark slots as available/unavailable
    // 6. Mark slots as available/unavailable using TRUE OVERLAP detection
    const processedSlots = allSlots.map(slot => {
      // Calculate slot absolute time range
      const [h, m] = slot.time.split(':').map(Number);
      // We need a stable date basis for comparison (using queryDate from above which is the target day)
      // queryDate is 00:00 of the target day in activeTimezone (UTC timestamp)
      // Actually queryDate might be Date object or number?
      // TimezoneUtils.parseDate returns Date.

      // Construct slot start date (UTC)
      // Since queryDate is the "Day Start" in UTC that represents 00:00 in target TZ
      // We can just add minutes.
      const slotStart = new Date(queryDate.getTime() + (h * 60 + m) * 60000);

      // Determine slot duration (use doctor's default or fallback)
      const slotDuration = Math.max(15, Number(schedule.slotDuration) || 30);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

      // Check for overlap with ANY existing appointment
      const hasConflict = existingAppointments.some(appt => {
        const apptStart = new Date(appt.date);
        const apptDuration = appt.service ? (parseInt(appt.service.duration) || 30) : 30;
        const apptEnd = new Date(apptStart.getTime() + apptDuration * 60000);
        return TimezoneUtils.hasOverlap(slotStart, slotEnd, apptStart, apptEnd);
      });

      // Check for overlap with ANY existing meeting
      const hasMeetingConflict = existingMeetings.some(mtg => {
        const mttStart = new Date(mtg.startTime);
        // Default meeting duration is 30 mins if endTime is missing
        const mttEnd = mtg.endTime ? new Date(mtg.endTime) : new Date(mttStart.getTime() + 30 * 60000);

        return TimezoneUtils.hasOverlap(slotStart, slotEnd, mttStart, mttEnd);
      });

      let available = !hasConflict && !hasMeetingConflict;

      // Keep existing logic for double booking 'type' blocking if needed, 
      // but 'available=false' is the main result.

      return {
        ...slot,
        available
      };
    });

    // 7. Filter by requested type if specified
    const filteredSlots = type
      ? processedSlots.filter(slot =>
        slot.type === type || slot.type === 'both'
      )
      : processedSlots;

    return {
      slots: filteredSlots.filter(s => s.available),
      allSlots: processedSlots // Include all for UI display
    };
  }

  /**
   * Generate time slots for a given time range
   */
  private generateSlotsForRange(
    start: string,
    end: string,
    intervalMinutes: number,
    type: string
  ): Array<{ time: string; type: 'online' | 'in-person' | 'both'; available: boolean }> {
    const slots: Array<{ time: string; type: 'online' | 'in-person' | 'both'; available: boolean }> = [];
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

      slots.push({
        time: timeStr,
        type: this.normalizeType(type),
        available: true
      });
    }

    return slots;
  }

  /**
   * Normalize appointment type string to standard format
   */
  private normalizeType(type: string): 'online' | 'in-person' | 'both' {
    if (!type) return 'both';

    const normalized = type.toLowerCase();
    if (normalized === 'online' || normalized === 'virtual') return 'online';
    if (normalized === 'in-person' || normalized === 'offline') return 'in-person';
    if (normalized === 'both' || normalized === 'mixed') return 'both';
    return 'both';
  }
}
