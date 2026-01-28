import { Injectable, Logger } from '@nestjs/common';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

import { AppointmentsService } from '../appointments/appointments.service';
import { WorkflowOrchestrator } from '../workflow/workflow.orchestrator';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private prisma: PrismaService,
    private appointmentsService: AppointmentsService,
    private workflowOrchestrator: WorkflowOrchestrator
  ) { }

  async onModuleInit() {
    await this.seedSystemForms();
  }

  private async seedSystemForms() {
    const systemForms = [
      {
        title: 'Book a Schedule',
        description: 'Multi-step appointment booking form.',
        systemType: 'LEAD',
        type: 'BOOKING',
        isActive: true,
        status: 'published',
        config: {
          title: 'Book a Schedule',
          steps: [
            {
              id: 'step-practitioner',
              title: 'Select Practitioner',
              fields: [
                {
                  id: 'practitioner-select',
                  type: 'doctor_selection',
                  label: 'Choose your Doctor',
                  required: true,
                  width: 'full',
                  locked: true
                }
              ]
            },
            {
              id: 'step-1',
              title: 'Select Service',
              fields: [
                {
                  id: 'service-select',
                  type: 'service_selection',
                  label: 'Choose a Service',
                  required: true,
                  width: 'full',
                  locked: true,
                  options: [] // Auto-populated by frontend/backend logic
                }
              ]
            },
            {
              id: 'step-2',
              title: 'Select Time',
              fields: [
                {
                  id: 'appointment-time',
                  type: 'schedule',
                  label: 'Pick a Date & Time',
                  required: true,
                  width: 'full',
                  locked: true
                }
              ]
            },
            {
              id: 'step-3',
              title: 'Your Details',
              fields: [
                { id: 'lead-name', type: 'text', label: 'Full Name', required: true, width: 'full', locked: true },
                { id: 'lead-email', type: 'text', label: 'Email Address', required: true, width: 'full', locked: true },
                { id: 'lead-phone', type: 'text', label: 'Phone Number', required: true, width: 'full', locked: true },
                { id: 'lead-age', type: 'number', label: 'Age', placeholder: 'Optional', required: false, width: 'half', locked: true },
                { id: 'lead-password', type: 'text', label: 'Create Password', placeholder: 'Set a password to access your patient portal', required: true, width: 'full', locked: true },
                { id: 'lead-reason', type: 'textarea', label: 'Reason for Visit', required: false, width: 'full' },
                { id: 'lead-notes', type: 'textarea', label: 'Additional Notes', placeholder: 'Any additional information you would like to share...', required: false, width: 'full', locked: true }
              ]
            }
          ]
        }
      },
      {
        title: 'Patient Intake Form',
        description: 'Initial intake form for new patients filling out history and vitals.',
        systemType: 'INTAKE',
        type: 'SYSTEM',
        status: 'published',
        isActive: true,
        config: {
          title: 'Patient Intake Form',
          steps: [
            {
              id: 'step-1',
              title: 'Personal Information',
              fields: [
                { id: 'patient-name', type: 'text', label: 'Full Name', required: true, width: 'full', locked: true },
                { id: 'patient-email', type: 'text', label: 'Email Address', required: true, width: 'full', locked: true },
                { id: 'patient-phone', type: 'text', label: 'Phone Number', required: true, width: 'full', locked: true }
              ]
            },
            {
              id: 'step-2',
              title: 'Medical History',
              fields: [
                { id: 'intake-allergies', type: 'textarea', label: 'Allergies', placeholder: 'Pollen, Penicillin, Peanuts (comma separated)', required: false, width: 'full' },
                { id: 'intake-meds', type: 'textarea', label: 'Current Medications', placeholder: 'Lisinopril 10mg, Aspirin (comma separated)', required: false, width: 'full' },
                { id: 'intake-hist', type: 'textarea', label: 'General Medical History', placeholder: 'Past surgeries, chronic conditions, etc.', required: false, width: 'full' },
                { id: 'intake-surg', type: 'textarea', label: 'Surgical History', placeholder: 'Any major surgeries in the past...', required: false, width: 'full' },
                { id: 'intake-family', type: 'textarea', label: 'Family Medical History', placeholder: 'History of diabetes, heart disease, etc. in family', required: false, width: 'full' }
              ]
            },
            {
              id: 'step-3',
              title: 'Vitals & Measurements',
              fields: [
                { id: 'intake-temp', type: 'number', label: 'Temperature (Celsius)', placeholder: '36.5', required: false, width: 'half' },
                { id: 'intake-bp', type: 'text', label: 'Blood Pressure (Systolic/Diastolic)', placeholder: '120/80', required: false, width: 'half' },
                { id: 'intake-hr', type: 'number', label: 'Heart Rate (BPM)', placeholder: '72', required: false, width: 'half' }
              ]
            }
          ]
        }
      },
      {
        title: 'Follow-up Feedback',
        description: 'Post-appointment feedback form.',
        systemType: 'FEEDBACK',
        status: 'published',
        config: {
          title: 'Follow-up Feedback',
          steps: [{
            id: 'step-1',
            title: 'Your Experience',
            fields: [
              {
                id: 'feedback-rating',
                type: 'select',
                label: 'How would you rate your visit?',
                required: true,
                width: 'full',
                locked: true,
                options: [
                  { label: '5 - Excellent', value: '5' },
                  { label: '4 - Good', value: '4' },
                  { label: '3 - Average', value: '3' },
                  { label: '2 - Poor', value: '2' },
                  { label: '1 - Terrible', value: '1' }
                ]
              },
              { id: 'feedback-comment', type: 'textarea', label: 'Comments', required: false, width: 'full' }
            ]
          }]
        }
      }
    ];

    for (const form of systemForms) {
      try {
        await this.prisma.form.upsert({
          where: { systemType: form.systemType as string },
          update: {
            title: form.title,
            description: form.description,
            status: form.status,
            isActive: form.isActive,
            config: form.config as any
          },
          create: {
            title: form.title,
            description: form.description,
            status: form.status,
            systemType: form.systemType,
            isActive: form.isActive,
            config: form.config as any
          }
        });
        this.logger.log(`[FormsService] Seeded/Updated system form: ${form.title}`);
      } catch (err: any) {
        this.logger.error(`[FormsService] Failed to seed system form ${form.title}:`, err);
      }
    }
  }


  private validateConfig(type: string, config: any) {
    if (type === 'BOOKING') {
      const allFields = config.steps?.flatMap((step: any) => step.fields) || config.fields || [];
      const fieldTypes = allFields.map((f: any) => f.type);

      const mandatory = ['doctor_selection', 'service_selection', 'schedule'];
      const missing = mandatory.filter(m => !fieldTypes.includes(m));

      if (missing.length > 0) {
        throw new Error(`Booking form is missing mandatory fields: ${missing.join(', ')}`);
      }
    }
  }

  async create(createFormDto: CreateFormDto) {
    this.validateConfig(createFormDto.type || 'CUSTOM', createFormDto.config);

    // If it's a booking form and isActive is true, deactivate others
    if (createFormDto.type === 'BOOKING' && createFormDto.isActive) {
      await this.prisma.form.updateMany({
        where: { type: 'BOOKING' },
        data: { isActive: false }
      });
    }

    return this.prisma.form.create({
      data: {
        title: createFormDto.title,
        description: createFormDto.description,
        status: createFormDto.status || 'draft',
        config: createFormDto.config || {},
        type: createFormDto.type || 'CUSTOM',
        isActive: createFormDto.isActive || false,
        clinicId: (createFormDto as any).clinicId || undefined
      }
    });
  }

  findAll() {
    return this.prisma.form.findMany({
      orderBy: [
        { systemType: 'desc' }, // Show system forms first (nulls last/first depends on DB, usually nulls last in desc? No, let's just sort by updatedAt)
        { updatedAt: 'desc' }
      ]
    });
  }

  findOne(id: string) {
    return this.prisma.form.findUnique({ where: { id } });
  }

  async update(id: string, updateFormDto: UpdateFormDto) {
    // If it's a booking form and isActive is true, deactivate others
    const currentForm = await this.prisma.form.findUnique({ where: { id } });

    if (!currentForm) {
      throw new Error('Form not found');
    }

    const newType = updateFormDto.type || currentForm.type;
    const newIsActive = updateFormDto.isActive !== undefined ? updateFormDto.isActive : currentForm.isActive;

    this.validateConfig(newType, updateFormDto.config || currentForm.config);

    if (newType === 'BOOKING' && newIsActive) {
      await this.prisma.form.updateMany({
        where: {
          type: 'BOOKING',
          id: { not: id }
        },
        data: { isActive: false }
      });
    }

    return this.prisma.form.update({
      where: { id },
      data: {
        title: updateFormDto.title,
        description: updateFormDto.description,
        status: updateFormDto.status,
        config: updateFormDto.config,
        type: updateFormDto.type,
        isActive: updateFormDto.isActive,
        clinicId: (updateFormDto as any).clinicId || undefined
      }
    });
  }

  remove(id: string) {
    return this.prisma.form.delete({ where: { id } });
  }

  async setDefault(id: string) {
    // Transaction: Unset all others, set this one
    return this.prisma.$transaction([
      this.prisma.form.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false }
      }),
      this.prisma.form.update({
        where: { id },
        data: { isDefault: true }
      })
    ]);
  }

  async findDefault() {
    // 1. Prioritize active booking form
    const activeBooking = await this.prisma.form.findFirst({
      where: { type: 'BOOKING', isActive: true, status: 'published' }
    });

    if (activeBooking) return activeBooking;

    // 2. Fallback to legacy isDefault
    return this.prisma.form.findFirst({
      where: { isDefault: true }
    });
  }

  async submit(id: string, submissionData: any, sessionToken?: string) {
    this.logger.log('='.repeat(60));
    this.logger.log(`Form ${id} submitted`);
    this.logger.log(`Raw submission data: ${JSON.stringify(submissionData, null, 2)}`);
    this.logger.log('='.repeat(60));

    // Fetch form configuration to map field IDs to field types/labels
    const form = await this.prisma.form.findUnique({ where: { id } });
    if (!form) {
      this.logger.error(`Form ${id} not found`);
      throw new Error('Form not found');
    }

    const config = form.config as any;
    const allFields = config.steps?.flatMap((step: any) => step.fields) || config.fields || [];

    this.logger.log(`Found ${allFields.length} fields in form config`);

    // Map field IDs to their data
    let scheduleFieldData: any = null;
    let patientName: string | null = null;
    let patientPhone: string | null = null;
    let patientEmail: string | null = null;
    let serviceIds: string[] = [];
    let patientNotes: string | null = null;
    let reasonForVisit: string | null = null;
    let patientPassword: string | null = null;
    let patientAge: number | null = null;
    let createdAppointment: any = null; // Track created appointment for response


    // Iterate through submission data and match with field types
    for (const [fieldId, value] of Object.entries(submissionData)) {
      const field = allFields.find((f: any) => f.id === fieldId);

      if (!field) {
        this.logger.warn(`Field ${fieldId} not found in form config`);
        continue;
      }

      this.logger.log(`Processing field: ${field.label} (${field.type}) = ${JSON.stringify(value)}`);

      // Match by field type or label
      if (field.type === 'schedule') {
        scheduleFieldData = value;
      } else if (field.type === 'service_selection') {
        serviceIds = Array.isArray(value) ? value : [value];
      } else if (field.type === 'doctor_selection' || field.type === 'practitioner_selection') {
        // Explicit practitioner selection from step 1
        // We will store this to ensure it overrides or informs the schedule logic
        if (value) {
          // If scheduleFieldData already exists (rare if steps are sequential, but possible), update it
          // OR store it in a temporary variable to merge later
          if (!scheduleFieldData) {
            scheduleFieldData = { practitioner: value };
          } else {
            scheduleFieldData.practitioner = value;
          }
        }
      } else if (field.type === 'text' || field.type === 'textarea') {
        // Match common patient field labels
        const label = field.label.toLowerCase();
        if (label.includes('name') || label.includes('full name')) {
          patientName = value as string;
        } else if (label.includes('phone')) {
          patientPhone = value as string;
        } else if (label.includes('email')) {
          patientEmail = value as string;
        } else if (label.includes('password') || fieldId === 'lead-password') {
          patientPassword = value as string;
        } else if (label.includes('additional notes') || fieldId === 'lead-notes') {
          patientNotes = value as string;
        } else if (label.includes('reason') || fieldId === 'lead-reason') {
          reasonForVisit = value as string;
        }
      } else if (field.type === 'number') {
        // Capture age from number fields
        const label = field.label.toLowerCase();
        if (label.includes('age') || fieldId === 'lead-age') {
          patientAge = value ? parseInt(value as string, 10) : null;
        }
      }
    }

    // [NEW] Harvest all form data for notes visibility
    const fullDataSummary = allFields
      .filter((f: any) => !['schedule', 'service_selection', 'doctor_selection', 'practitioner_selection'].includes(f.type))
      .map((f: any) => {
        const val = submissionData[f.id];
        if (val === undefined || val === null || val === '') return null;
        return `${f.label}: ${typeof val === 'object' ? JSON.stringify(val) : val}`;
      })
      .filter(Boolean)
      .join('\n');

    this.logger.log(`Mapped data: name=${patientName}, phone=${patientPhone}, email=${patientEmail}`);
    this.logger.log(`Schedule data: ${JSON.stringify(scheduleFieldData)}`);
    this.logger.log(`Service IDs: ${JSON.stringify(serviceIds)}`);

    // 1.5 Determine Clinic Context
    let finalClinicId = form.clinicId;
    if (!finalClinicId) {
      const fallbackClinic = await this.prisma.clinic.findFirst();
      finalClinicId = fallbackClinic?.id || null;
    }

    let patientId: string | null = null;
    let appointmentId: string | null = null;

    // 1.7 Resolve from Session (Magic Link)
    if (sessionToken) {
      const session = await this.prisma.intakeSession.findUnique({
        where: { token: sessionToken }
      });

      if (session && session.status === 'PENDING') {
        patientId = session.patientId;
        appointmentId = session.appointmentId;
        this.logger.log(`Resolved patient ${patientId} from session token`);

        // Mark session as completed
        await this.prisma.intakeSession.update({
          where: { id: session.id },
          data: { status: 'COMPLETED' }
        });
      }
    }

    // 2. Auto-Create/Find Patient (only if not resolved from session)
    if (!patientId && patientName && patientPhone) {
      try {
        // STRICT LOOKUP: Prefer Email to support distinct accounts with same phone (e.g. family, testing)
        let existing: any = null;
        if (patientEmail) {
          existing = await this.prisma.patient.findFirst({ where: { email: patientEmail } });
        } else if (patientPhone) {
          existing = await this.prisma.patient.findFirst({ where: { phone: patientPhone } });
        }

        if (existing) {
          patientId = existing.id;
          this.logger.log(`Found existing patient: ${patientId}`);

          // [OPTIONAL] If patient has no clinic, assign them to this one?
          // Also update age if provided
          const updateData: any = {};
          if (!existing.clinicId && finalClinicId) {
            updateData.clinicId = finalClinicId;
          }
          if (patientAge !== null && patientAge !== existing.age) {
            updateData.age = patientAge;
          }

          if (Object.keys(updateData).length > 0) {
            await this.prisma.patient.update({
              where: { id: existing.id },
              data: updateData
            });
          }

        } else {
          const newPatient = await this.prisma.patient.create({
            data: {
              name: patientName,
              email: patientEmail,
              phone: patientPhone,
              age: patientAge,
              clinicId: finalClinicId // [FIX] Assign clinic
            }
          });
          patientId = newPatient.id;
          this.logger.log(`Auto-created Patient: ${patientId}`);
        }
      } catch (error) {
        this.logger.error("Failed to find/create patient", error);
      }
    } else {
      this.logger.warn(`Skipping patient creation: Missing name or phone`);
    }

    // 3. Auto-Create Appointment
    if (scheduleFieldData) {
      // New format: { practitioner: "id", date: "ISO string", time: "HH:MM" }
      const practitionerId = scheduleFieldData.practitioner;
      const dateStr = scheduleFieldData.date;
      const timeStr = scheduleFieldData.time;

      this.logger.log(`Parsed schedule data: practitioner=${practitionerId}, date=${dateStr}, time=${timeStr}`);

      if (practitionerId && dateStr && timeStr) {
        try {
          const serviceId = serviceIds.length > 0 ? serviceIds[0] : null;

          // Use the clinicId from the form, already determined above
          // let finalClinicId = ... (removed local shadowing)

          this.logger.log(`Creating appointment with: patientId=${patientId}, doctorId=${practitionerId}, serviceId=${serviceId}, clinicId=${finalClinicId}, date=${dateStr}, time=${timeStr}`);

          const appointmentNotes = reasonForVisit ? `Reason: ${reasonForVisit}` : '';

          // Determine appointment type (Online vs In-Person)
          let consultationType = 'in-person';
          const typeValue = submissionData['service-select-consultation-type'];
          if (typeValue === 'Online' || typeValue === 'Virtual' || typeValue === 'Video') {
            consultationType = 'video';
          }

          // Use AppointmentsService.create to trigger automation
          // IMPORTANT: Pass date and time as STRINGS so AppointmentsService 
          // can properly convert them using the clinic's timezone
          const createDto: any = {
            clinicId: finalClinicId,
            serviceId: serviceId,
            doctorId: practitionerId,
            date: dateStr,  // YYYY-MM-DD string
            time: timeStr,  // HH:MM string
            notes: appointmentNotes + (patientNotes ? `\n\nNotes: ${patientNotes}` : '') + (fullDataSummary ? `\n\n--- Form Data ---\n${fullDataSummary}` : ''),
            patientId: patientId,
            guestName: !patientId ? patientName : undefined,
            guestEmail: !patientId ? patientEmail : undefined,
            guestPhone: !patientId ? patientPhone : undefined,
            password: patientPassword,
            type: consultationType,
            formId: id
          };

          this.logger.log(`Delegating to AppointmentsService.create with type=${consultationType}`);
          const appointment = await this.appointmentsService.create(createDto);

          this.logger.log(`✅ Auto-created Appointment via Service: ${appointment.id}`);

          // Store appointment for response
          createdAppointment = appointment;
        } catch (error) {
          this.logger.error("❌ Failed to create appointment");
          this.logger.error(`Error name: ${error.name}`);
          this.logger.error(`Error message: ${error.message}`);
          this.logger.error(`Error stack: ${error.stack}`);
          if (error.code) {
            this.logger.error(`Error code: ${error.code}`);
          }

          // Re-throw error to prevent false success message
          throw new Error(error.message || 'Failed to create appointment');
        }
      } else {
        this.logger.warn(`Skipping appointment creation: Missing data - practitioner=${practitionerId}, date=${dateStr}, time=${timeStr}`);
      }
    } else {
      this.logger.warn("No schedule data found in submission");
    }

    // 4. Persist Raw Submission
    const submission = await this.prisma.formSubmission.create({
      data: {
        formId: id,
        patientId: patientId,
        appointmentId: createdAppointment?.id,
        data: submissionData
      }
    });

    // 5. [NEW] Process Intake to EHR Automation
    if (form.systemType === 'INTAKE' && patientId) {
      let doctorId: string | undefined;

      if (appointmentId) {
        const apt = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
        doctorId = apt?.doctorId;
      }

      const finalDoctorId = doctorId || createdAppointment?.doctorId || (await this.prisma.user.findFirst({ where: { role: 'doctor' } }))?.id;

      if (finalDoctorId && finalClinicId) {
        await this.processIntakeToEhr(patientId, finalDoctorId, finalClinicId, submissionData);
      }
    }

    // Update form submission count
    await this.prisma.form.update({
      where: { id },
      data: { submissions: { increment: 1 } }
    });

    // Trigger workflows for form submission
    if (createdAppointment && patientId) {
      try {
        // Determine patient type (will be calculated in appointments service)
        // For now, trigger with basic context and let orchestrator filter
        this.workflowOrchestrator.triggerEvent('FORM_SUBMITTED', {
          patientId,
          appointmentId: createdAppointment.id,
          formId: id,
          // patientType will be determined by orchestrator if needed
        } as any).catch(err => {
          this.logger.error('Failed to trigger form submission workflow', err);
        });
      } catch (err) {
        this.logger.error('Error triggering form workflows', err);
      }
    }

    // Return appointment details if created
    const response: any = {
      success: true,
      message: "Submission received"
    };

    if (createdAppointment) {
      // Fetch doctor's timezone for frontend display
      const doctor = await this.prisma.user.findUnique({
        where: { id: createdAppointment.doctorId },
        select: { timezone: true }
      });

      response.appointment = {
        id: createdAppointment.id,
        date: createdAppointment.date,
        type: createdAppointment.type,
        status: createdAppointment.status,
        doctorId: createdAppointment.doctorId,
        patientId: createdAppointment.patientId,
        doctorTimezone: doctor?.timezone || 'UTC' // [NEW] Return doctor's timezone
      };

      // Include meeting link if it's a video appointment
      if (createdAppointment.type === 'video' && (createdAppointment as any).meetingLink) {
        response.meetingLink = (createdAppointment as any).meetingLink;
      }
    }

    return response;
  }

  async createIntakeSession(patientId: string, appointmentId?: string) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    return this.prisma.intakeSession.create({
      data: {
        token,
        patientId,
        appointmentId,
        expiresAt,
        status: 'PENDING'
      }
    });
  }

  async getIntakeSession(token: string) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { token },
      include: {
        patient: true,
        appointment: {
          include: {
            doctor: true,
            service: true
          }
        }
      }
    });

    if (!session) return null;

    // Get the active intake form config OR any intake form if none active
    const form = await this.prisma.form.findFirst({
      where: {
        systemType: 'INTAKE',
        status: 'published'
      },
      orderBy: { isActive: 'desc' } // Prioritize active form
    });

    return {
      session,
      form
    };
  }


  getSubmissions(id: string) {
    return this.prisma.formSubmission.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Internal helper to map intake submission data to EHR clinical records
   */
  private async processIntakeToEhr(patientId: string, doctorId: string, clinicId: string, data: any) {
    this.logger.log(`Processing intake to EHR for patient ${patientId}`);

    try {
      // 1. Map Allergies
      if (data['intake-allergies']) {
        const allergies = (data['intake-allergies'] as string).split(',').map(s => s.trim()).filter(Boolean);
        for (const allergy of allergies) {
          await this.prisma.allergy.create({
            data: {
              patientId,
              doctorId,
              clinicId,
              substance: allergy,
              reaction: 'Reported by patient via intake',
              severity: 'Unknown',
              recordedAt: new Date()
            }
          });
        }
      }

      // 2. Map Medications
      if (data['intake-meds']) {
        const meds = (data['intake-meds'] as string).split(',').map(s => s.trim()).filter(Boolean);
        for (const med of meds) {
          await this.prisma.medication.create({
            data: {
              patientId,
              doctorId,
              clinicId,
              name: med,
              dosage: 'As reported',
              frequency: 'As reported',
              status: 'DRAFT' // For doctor verification
            }
          });
        }
      }

      // 3. Map Vitals
      const bp = data['intake-bp'];
      const hr = data['intake-hr'] ? parseInt(data['intake-hr']) : null;
      const temp = data['intake-temp'] ? parseFloat(data['intake-temp']) : null;

      if (bp || hr || temp) {
        let bpSystolic: number | null = null;
        let bpDiastolic: number | null = null;

        if (bp && bp.includes('/')) {
          const [s, d] = bp.split('/').map((v: string) => parseInt(v.trim()));
          bpSystolic = s || null;
          bpDiastolic = d || null;
        }

        await this.prisma.vitals.create({
          data: {
            patientId,
            doctorId,
            clinicId,
            bpSystolic,
            bpDiastolic,
            heartRate: hr,
            temperature: temp,
            recordedAt: new Date()
          }
        });
      }

      // 4. Map Observations (Patient History)
      if (data['intake-hist']) {
        await this.prisma.patientObservation.create({
          data: {
            patientId,
            recordedByUserId: doctorId,
            clinicId,
            type: 'HISTORY',
            value: data['intake-hist'],
            notes: 'Self-reported medical history via intake form',
            status: 'PRELIMINARY'
          }
        });
      }

      if (data['intake-surg']) {
        await this.prisma.patientObservation.create({
          data: {
            patientId,
            recordedByUserId: doctorId,
            clinicId,
            type: 'HISTORY',
            value: `Surgical History: ${data['intake-surg']}`,
            notes: 'Self-reported surgical history via intake form',
            status: 'PRELIMINARY'
          }
        });
      }

      if (data['intake-family']) {
        await this.prisma.patientObservation.create({
          data: {
            patientId,
            recordedByUserId: doctorId,
            clinicId,
            type: 'HISTORY',
            value: `Family History: ${data['intake-family']}`,
            notes: 'Self-reported family history via intake form',
            status: 'PRELIMINARY'
          }
        });
      }

    } catch (err) {
      this.logger.error(`Failed to process intake to EHR: ${err.message}`);
    }
  }
}
