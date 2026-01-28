import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { TwilioService } from '../services/twilio.service';
import { SmsSenderService } from '../services/sms-sender.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { WhatsAppTierService } from '../services/whatsapp-tier.service';
import { addMinutes, subMinutes, addHours, differenceInMilliseconds } from 'date-fns';
import * as Handlebars from 'handlebars';

@Injectable()
export class WorkflowOrchestrator {
    private readonly logger = new Logger(WorkflowOrchestrator.name);

    constructor(
        private prisma: PrismaService,
        @InjectQueue('workflow-queue') private workflowQueue: Queue,
        private mailerService: DynamicMailerService,
        private twilioService: TwilioService,
        private smsSenderService: SmsSenderService,
        private whatsappTierService: WhatsAppTierService,
        private emailTemplatesService: EmailTemplatesService,
    ) { }

    /**
     * Triggers all active workflows for a specific event type
     */
    async triggerEvent(eventType: string, context: { patientId: string; appointmentId?: string; clinicId?: string; patientType?: 'NEW' | 'RECURRING'; formId?: string;[key: string]: any }) {
        this.logger.log(`Triggering Event: ${eventType} for Patient ${context.patientId}`);

        // Determine patient type (default to NEW if not provided)
        const patientType = context.patientType || 'NEW';
        this.logger.log(`Patient Type: ${patientType}`);

        // Build where clause for filtering
        const whereClause: any = {
            triggerType: eventType,
            isActive: true,
            OR: [
                { patientType: 'ALL' },
                { patientType }
            ]
        };

        // CRITICAL: Filter by clinic ID for strict isolation
        // Each clinic can ONLY trigger their own workflows
        if (context.clinicId) {
            whereClause.clinicId = context.clinicId;
            this.logger.log(`Filtering workflows for clinic: ${context.clinicId}`);
        } else {
            // If no clinicId provided, don't match any workflows
            this.logger.warn(`No clinicId in context - skipping workflow trigger for event ${eventType}`);
            return;
        }

        // Filter by formId
        // If context.formId is provided, match workflows with that formId OR null (All Forms)
        // If context.formId is NOT provided (e.g. manual appointment), only match workflows with formId: null
        whereClause.AND = [
            {
                OR: [
                    { formId: null },
                    ...(context.formId ? [{ formId: context.formId }] : [])
                ]
            }
        ];

        const definitions = await this.prisma.workflowDefinition.findMany({
            where: whereClause
        });

        if (definitions.length === 0) {
            this.logger.log(`No active workflows found for clinic ${context.clinicId}, event ${eventType}, patient type ${patientType}, formId ${context.formId || 'any'}`);
            this.logger.log(`⚠️  NO COMMUNICATION WILL BE SENT - No workflows configured`);
            return;
        }

        this.logger.log(`Found ${definitions.length} matching workflows for clinic ${context.clinicId}, ${patientType} patients${context.formId ? ` and form ${context.formId}` : ''}`);

        for (const def of definitions) {
            await this.startWorkflow(def.id, context);
        }
    }

    /**
     * Starts a workflow instance for a patient/appointment
     */
    async startWorkflow(definitionId: String, context: { patientId: string; appointmentId?: string;[key: string]: any }) {
        // 1. Fetch Definition
        const definition = await this.prisma.workflowDefinition.findUnique({
            where: { id: definitionId as string }, // explicit casting if needed
        });

        if (!definition || !definition.isActive) {
            this.logger.warn(`Workflow ${definitionId} not found or inactive`);
            return;
        }

        let nodes: any[] = [];
        try {
            nodes = typeof definition.nodes === 'string' ? JSON.parse(definition.nodes) : definition.nodes;
        } catch (e) {
            nodes = definition.nodes as any[];
        }

        const startNode = nodes.find((n) => n.type === 'trigger');

        if (!startNode) {
            this.logger.error('No start node found for workflow');
            return;
        }

        // 2. Create Instance
        const instance = await this.prisma.workflowInstance.create({
            data: {
                workflowId: definition.id,
                patientId: context.patientId,
                appointmentId: context.appointmentId,
                status: 'RUNNING',
                currentNodeId: startNode.id,
                contextData: context, // Save initial context
            },
        });

        this.logger.log(`Started Workflow Instance ${instance.id}`);

        // 3. Execute First Node
        await this.processNode(instance.id, startNode.id);
    }

    // CRUD Methods
    async createWorkflowDefinition(data: Prisma.WorkflowDefinitionCreateInput) {
        return this.prisma.workflowDefinition.create({
            data: {
                name: data.name || 'New Workflow',
                triggerType: data.triggerType || 'APPOINTMENT_CREATED',
                patientType: data.patientType || 'ALL',
                formId: data.formId || null,
                nodes: data.nodes || [],
                edges: data.edges || [],
                uiData: data.uiData || {},
                isActive: true
            }
        });
    }

    async getWorkflows() {
        return this.prisma.workflowDefinition.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { instances: { where: { status: 'RUNNING' } } }
                }
            }
        });
    }

    async getWorkflowById(id: string) {
        return this.prisma.workflowDefinition.findUnique({
            where: { id }
        });
    }

    async updateWorkflowDefinition(id: string, data: any) {
        try {
            return await this.prisma.workflowDefinition.update({
                where: { id },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.nodes && { nodes: data.nodes }),
                    ...(data.edges && { edges: data.edges }),
                    ...(data.uiData && { uiData: data.uiData }),
                    ...(data.triggerType && { triggerType: data.triggerType }),
                    ...(data.patientType && { patientType: data.patientType }),
                    ...(data.formId !== undefined && { formId: data.formId }),
                    ...(data.isActive !== undefined && { isActive: data.isActive }),
                }
            });
        } catch (error) {
            // If record not found, return null or throw specific error
            if (error.code === 'P2025') return null;
            throw error;
        }
    }

    async deleteWorkflowDefinition(id: string) {
        try {
            return await this.prisma.workflowDefinition.delete({
                where: { id }
            });
        } catch (error) {
            if (error.code === 'P2025') return null;
            throw error;
        }
    }

    /**
     * Main Execution Logic for a Node
     */
    async processNode(instanceId: string, nodeId: string) {
        const instance = await this.prisma.workflowInstance.findUnique({
            where: { id: instanceId },
            include: { workflow: true },
        });

        if (!instance) return;

        const nodes = instance.workflow.nodes as any[];
        const edges = instance.workflow.edges as any[];
        const node = nodes.find((n) => n.id === nodeId);

        if (!node) {
            this.logger.error(`Node ${nodeId} not found`);
            return;
        }

        this.logger.log(`Processing Node: ${node.type} (${node.id})`);

        // --- NODE LOGIC SWITCH ---
        try {
            switch (node.type) {
                case 'trigger':
                    // Pass through
                    await this.transitionToNext(instance, node, edges);
                    break;

                case 'delay':
                    await this.handleDelay(instance, node);
                    // Execution stops here, resumed by Queue Processor
                    return;

                case 'action':
                    await this.handleAction(instance, node);
                    await this.transitionToNext(instance, node, edges);
                    break;

                case 'condition':
                    const result = await this.evaluateCondition(instance, node);
                    this.logger.log(`Condition result for node ${node.id}: ${result}`);
                    await this.transitionToNext(instance, node, edges, result ? 'true' : 'false');
                    break;

                case 'wait_for_input':
                    await this.handleWaitForInput(instance, node);
                    return; // Stop execution, wait for external event

                default:
                    this.logger.warn(`Unknown node type: ${node.type}`);
                    await this.transitionToNext(instance, node, edges);
            }
        } catch (error) {
            this.logger.error(`Error processing node ${nodeId}: ${error.message}`);
            await this.prisma.workflowInstance.update({
                where: { id: instanceId },
                data: { status: 'FAILED' },
            });
            await this.prisma.workflowExecutionLog.create({
                data: {
                    instanceId,
                    stepId: nodeId,
                    status: 'FAILED',
                    message: error.message
                }
            });
        }
    }

    /**
     * Handles Wait For Input (Interactive) Nodes
     * Suspends the workflow until an external event (reply) occurs.
     */
    private async handleWaitForInput(instance: any, node: any) {
        this.logger.log(`Suspending workflow ${instance.id} at node ${node.id} waiting for ${node.data.inputType}`);

        await this.prisma.workflowInstance.update({
            where: { id: instance.id },
            data: {
                status: 'WAITING_FOR_INPUT',
                // We could set a timeout here using nextRunAt if we want auto-expiry
            }
        });
    }

    /**
     * Public method to trigger an input event (e.g. SMS reply)
     * Resumes any suspended workflows for this patient.
     */
    async triggerInputEvent(patientId: string, inputType: 'SMS' | 'WHATSAPP' | 'EMAIL', content: string) {
        this.logger.log(`Received input event from Patient ${patientId}: [${inputType}] ${content}`);

        // Find all suspended instances for this patient
        const instances = await this.prisma.workflowInstance.findMany({
            where: {
                patientId,
                status: 'WAITING_FOR_INPUT'
            },
            include: { workflow: true }
        });

        this.logger.log(`Found ${instances.length} waiting instances for patient.`);

        for (const instance of instances) {
            await this.processInputForInstance(instance, inputType, content);
        }
    }

    private async processInputForInstance(instance: any, inputType: string, content: string) {
        const nodes = typeof instance.workflow.nodes === 'string' ? JSON.parse(instance.workflow.nodes) : instance.workflow.nodes;
        const edges = typeof instance.workflow.edges === 'string' ? JSON.parse(instance.workflow.edges) : instance.workflow.edges;

        const currentNode = nodes.find((n: any) => n.id === instance.currentNodeId);
        if (!currentNode || currentNode.type !== 'wait_for_input') return;

        // Check if input type matches node config (e.g. only listen to SMS if node says SMS)
        // For simplicity, we might allow generous matching or strict matching.
        // let expectedType = currentNode.data.inputType || 'SMS_REPLY';

        // Branching Logic
        const branches = currentNode.data.branches || {}; // Map: { "yes": "node_id_1", "no": "node_id_2" }
        const normalizedContent = content.trim().toLowerCase();

        // Find matching branch
        let nextNodeId: string | null = null;
        let matchLabel: string | null = null;

        // 1. Direct Match
        if (branches[normalizedContent]) {
            nextNodeId = branches[normalizedContent];
            matchLabel = normalizedContent;
        }
        // 2. Keyword/Contains Match (Optional enhancement)
        else {
            // Check if any key is contained in the message?
            for (const key of Object.keys(branches)) {
                if (normalizedContent.includes(key)) {
                    nextNodeId = branches[key];
                    matchLabel = key;
                    break;
                }
            }
        }

        if (nextNodeId) {
            this.logger.log(`Input matched branch '${matchLabel}'. Resuming workflow to node ${nextNodeId}`);

            // Log interaction
            await this.prisma.workflowExecutionLog.create({
                data: {
                    instanceId: instance.id,
                    stepId: currentNode.id,
                    status: 'COMPLETED',
                    message: `Received input: "${content}". Matched: "${matchLabel}"`
                }
            });

            // Resume flow
            await this.prisma.workflowInstance.update({
                where: { id: instance.id },
                data: { status: 'RUNNING', currentNodeId: nextNodeId }
            });

            await this.processNode(instance.id, nextNodeId);
        } else {
            this.logger.log(`Input "${content}" did not match any branches for node ${currentNode.id}. Ignoring.`);
            // Optionally we could track "Invalid Reply" or have a default branch
        }
    }

    /**
     * Moves the pointer to the next node
     */
    async transitionToNext(instance: any, currentNode: any, edges: any[], handleId?: string) {
        // Find outgoing edge
        let validEdges = edges.filter(e => e.source === currentNode.id);

        // Filter by handle if specified (for branching)
        if (handleId) {
            validEdges = validEdges.filter(e => e.sourceHandle === handleId || e.label === handleId);
            // React Flow edges usually have sourceHandle for handles
        }

        if (validEdges.length === 0) {
            this.logger.log(`Workflow ${instance.id} Completed`);
            await this.prisma.workflowInstance.update({
                where: { id: instance.id },
                data: { status: 'COMPLETED', currentNodeId: null },
            });
            return;
        }

        // Assume single path for now unless branching
        const nextNodeId = validEdges[0].target;

        // Update Instance
        await this.prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { currentNodeId: nextNodeId },
        });

        // Recursively process next
        await this.processNode(instance.id, nextNodeId);
    }

    /**
     * Handles Delay Nodes via BullMQ
     */
    private async handleDelay(instance: any, node: any) {
        let delayMs = 0;
        const mode = node.data?.delayMode || 'FIXED';
        const value = parseInt(node.data?.delayValue || '0');
        const unit = node.data?.delayUnit || 'MINUTES';

        // Helper to get ms multiplier
        const getMultiplier = (u: string) => {
            if (u === 'HOURS') return 3600000;
            if (u === 'DAYS') return 86400000;
            return 60000; // MINUTES
        };

        if (mode === 'FIXED') {
            delayMs = value * getMultiplier(unit);
        }
        else if (mode === 'UNTIL_BEFORE' || mode === 'UNTIL_AFTER') {
            // Fetch appointment date
            if (!instance.appointmentId) {
                this.logger.warn(`Cannot calculate relative delay: No appointment ID for Instance ${instance.id}`);
                // Proceed immediately if we can't calculate
                const edges = typeof instance.workflow.edges === 'string' ? JSON.parse(instance.workflow.edges) : instance.workflow.edges;
                return this.transitionToNext(instance, node, edges);
            }

            const appt = await this.prisma.appointment.findUnique({ where: { id: instance.appointmentId as string } });
            if (!appt) {
                this.logger.warn(`Appointment not found for delay calculation`);
                const edges = typeof instance.workflow.edges === 'string' ? JSON.parse(instance.workflow.edges) : instance.workflow.edges;
                return this.transitionToNext(instance, node, edges);
            }

            let targetDate = new Date(appt.date);
            const offsetMs = value * getMultiplier(unit);

            if (mode === 'UNTIL_BEFORE') {
                targetDate = new Date(targetDate.getTime() - offsetMs);
            } else {
                targetDate = new Date(targetDate.getTime() + offsetMs);
            }

            delayMs = differenceInMilliseconds(targetDate, new Date());
        }

        if (delayMs <= 0) {
            this.logger.log(`Delay is non-positive (${delayMs}ms). Checking onPast policy...`);

            // Check for 'Skip if Past' policy
            // If the delay target is in the past (e.g. 24h reminder for an appointment created 2h ago), 
            // we might want to SKIP the entire branch instead of sending it immediately.
            const onPast = node.data?.onPast || 'RUN'; // Default to RUN (legacy behavior)

            if (onPast === 'SKIP' && (mode === 'UNTIL_BEFORE' || mode === 'UNTIL_AFTER')) {
                this.logger.log(`[Flow Control] Skipping delay node ${node.id} because target time is past and onPast='SKIP'. Terminating workflow branch.`);

                // Option A: Terminate Workflow
                // Option B: Follow a 'false' path? 
                // For now, per requirement "otherwise not", we terminate this execution path.
                await this.prisma.workflowInstance.update({
                    where: { id: instance.id },
                    data: { status: 'COMPLETED', currentNodeId: null }
                });
                return;
            }

            this.logger.log(`Proceeding immediately (onPast=${onPast}).`);
            const edges = typeof instance.workflow.edges === 'string' ? JSON.parse(instance.workflow.edges) : instance.workflow.edges;
            return this.transitionToNext(instance, node, edges);
        }

        const nextRunAt = new Date(Date.now() + delayMs);
        this.logger.log(`Persisting delay until ${nextRunAt.toISOString()} for Instance ${instance.id}`);

        // Persist to DB instead of Queue
        await this.prisma.workflowInstance.update({
            where: { id: instance.id },
            data: {
                status: 'WAITING',
                nextRunAt: nextRunAt
            }
        });
    }

    private async handleAction(instance: any, node: any) {
        const actionContent = node.data.message || node.data.payload;
        const actionType = (node.data.actionType || '').toLowerCase();
        this.logger.log(`[ACTION] Executing ${actionType} -> ${actionContent ? actionContent.substring(0, 50) + '...' : 'empty'}`);

        if (actionType === 'email') {
            const context = instance.contextData as any;
            const recipient = context.email;

            if (!recipient) {
                this.logger.warn(`No recipient email found for instance ${instance.id}`);
                return;
            }

            // Find the doctor associated with this workflow/appointment
            // 1. Try Context (Passed from AppointmentService)
            let doctorId = context.doctorId;

            // 2. Try DB Lookup via Appointment (Fallback)
            if (!doctorId && instance.appointmentId) {
                const appt = await this.prisma.appointment.findUnique({ where: { id: instance.appointmentId } });
                doctorId = appt?.doctorId || '';
            }

            // 3. Fallback to Admin (Last Resort - usually unsafe but kept for legacy)
            if (!doctorId) {
                const user = await this.prisma.user.findFirst();
                doctorId = user?.id || '';
            }

            if (!doctorId) {
                this.logger.error("No doctor found for sending email");
                return;
            }

            // Template Logic
            let emailSubject = node.data.subject || 'Follow-up from MediFlow';
            let emailBody = node.data.message || node.data.payload || '<p>Hello, this is an automated message.</p>';
            let isHtml = true;

            if (node.data.templateId) {
                const template = await this.emailTemplatesService.findOne(node.data.templateId);
                if (template) {
                    emailSubject = template.subject;
                    emailBody = template.bodyHtml || template.bodyText;
                }
            }

            // Render email template with actual data
            const renderedSubject = this.renderTemplate(emailSubject, context);
            const renderedBody = this.renderTemplate(emailBody, context);

            // Log Execution Start
            await this.prisma.workflowExecutionLog.create({
                data: {
                    instanceId: instance.id,
                    stepId: node.id,
                    status: 'SENT', // Marking as sent since we are about to call send (async)
                    message: `Sending Email to ${recipient}`
                }
            });

            try {
                await this.mailerService.sendMail(doctorId, {
                    to: recipient,
                    subject: renderedSubject,
                    html: renderedBody
                });
                this.logger.log(`Email sent to ${recipient}`);

                // CREATE COMMUNICATION LOG
                await this.prisma.communicationLog.create({
                    data: {
                        patientId: context.patientId,
                        workflowId: instance.workflowId,
                        appointmentId: instance.appointmentId || null,
                        type: 'EMAIL',
                        status: 'SENT',
                        direction: 'OUTBOUND',
                        content: `Subject: ${renderedSubject}\n\n${renderedBody}`,
                        providerId: 'smtp' // Or real ID if available
                    }
                });

            } catch (err) {
                this.logger.error(`Failed to send email: ${err.message}`);
                // Log failure
                await this.prisma.communicationLog.create({
                    data: {
                        patientId: context.patientId,
                        workflowId: instance.workflowId,
                        appointmentId: instance.appointmentId || null,
                        type: 'EMAIL',
                        status: 'FAILED',
                        direction: 'OUTBOUND',
                        content: `Failed: ${err.message}`,
                    }
                });
            }
        }
        else if (actionType === 'sms') {
            const context = instance.contextData as any;
            const recipient = context.phone || context.patientPhone; // Assuming phone in context

            if (!recipient) {
                this.logger.warn(`No recipient phone found for instance ${instance.id}`);
                return;
            }

            // Resolve Doctor ID
            let doctorId = context.doctorId;

            // 2. Try DB Lookup
            if (!doctorId && instance.appointmentId) {
                const appt = await this.prisma.appointment.findUnique({ where: { id: instance.appointmentId } });
                doctorId = appt?.doctorId || '';
            } else if (!doctorId) {
                const user = await this.prisma.user.findFirst();
                doctorId = user?.id || '';
            }

            if (!doctorId) {
                this.logger.error("No doctor found for sending SMS");
                return;
            }

            // Render SMS template with actual data
            const smsMessage = this.renderTemplate(node.data.message || node.data.payload || 'Hello from MediFlow', context);

            try {
                // Use SmsSenderService to get tier-based identity
                const smsIdentity = await this.smsSenderService.getSmsIdentity(doctorId);

                // Send SMS using tier-based from address
                await this.twilioService.sendSms(smsIdentity.from, recipient, smsMessage, doctorId);
                this.logger.log(`SMS sent to ${recipient} from ${smsIdentity.from} (Tier: ${smsIdentity.tier})`);

                // CREATE COMMUNICATION LOG with tier tracking
                await this.prisma.communicationLog.create({
                    data: {
                        patientId: context.patientId,
                        workflowId: instance.workflowId,
                        appointmentId: instance.appointmentId || null,
                        type: 'SMS',
                        status: 'SENT',
                        direction: 'OUTBOUND',
                        content: smsMessage,
                        tierUsed: smsIdentity.tier,
                        fromIdentity: smsIdentity.from,
                    }
                });

            } catch (err) {
                this.logger.error(`Failed to send SMS: ${err.message}`);
                // Log failure
                await this.prisma.communicationLog.create({
                    data: {
                        patientId: context.patientId,
                        workflowId: instance.workflowId,
                        appointmentId: instance.appointmentId || null,
                        type: 'SMS',
                        status: 'FAILED',
                        direction: 'OUTBOUND',
                        content: `Failed: ${err.message}`,
                    }
                });
            }
        }
        else if (node.data.actionType === 'whatsapp') {
            const context = instance.contextData as any;
            const recipient = context.phone;

            if (!recipient) {
                this.logger.warn(`No recipient phone found for instance ${instance.id}`);
                return;
            }

            // Resolve Doctor ID
            let doctorId = context.doctorId;

            if (!doctorId && instance.appointmentId) {
                const appt = await this.prisma.appointment.findUnique({ where: { id: instance.appointmentId } });
                doctorId = appt?.doctorId || '';
            } else if (!doctorId) {
                const user = await this.prisma.user.findFirst();
                doctorId = user?.id || '';
            }

            if (!doctorId) {
                this.logger.error("No doctor found for sending WhatsApp");
                return;
            }

            // Render WhatsApp template with actual data
            const whatsappMessage = this.renderTemplate(node.data.message || node.data.payload || 'Hello from MediFlow', context);

            try {
                // Use WhatsAppTierService for tier-based sending
                await this.whatsappTierService.sendWhatsApp(doctorId, recipient, whatsappMessage);
                this.logger.log(`WhatsApp sent to ${recipient} via tier service`);

                // CREATE COMMUNICATION LOG
                await this.prisma.communicationLog.create({
                    data: {
                        patientId: context.patientId,
                        workflowId: instance.workflowId,
                        appointmentId: instance.appointmentId || null,
                        type: 'WHATSAPP',
                        status: 'SENT',
                        direction: 'OUTBOUND',
                        content: whatsappMessage,
                    }
                });

            } catch (err) {
                this.logger.error(`Failed to send WhatsApp: ${err.message}`);
                await this.prisma.communicationLog.create({
                    data: {
                        patientId: context.patientId,
                        workflowId: instance.workflowId,
                        appointmentId: instance.appointmentId || null,
                        type: 'WHATSAPP',
                        status: 'FAILED',
                        direction: 'OUTBOUND',
                        content: `Failed: ${err.message}`,
                    }
                });
            }
        }
        else if (actionType === 'cancel_appointment') {
            const context = instance.contextData as any;
            const apptId = instance.appointmentId || context.appointmentId;

            if (!apptId) {
                this.logger.warn(`Cannot cancel appointment: No Appointment ID for instance ${instance.id}`);
                return;
            }

            // Cancel Appointment
            await this.prisma.appointment.update({
                where: { id: apptId },
                data: { status: 'cancelled' }
            });

            this.logger.log(`Appointment ${apptId} cancelled by workflow action`);

            // Update Context
            await this.prisma.workflowInstance.update({
                where: { id: instance.id },
                data: {
                    contextData: {
                        ...(instance.contextData as object),
                        appointmentStatus: 'cancelled'
                    }
                }
            });

            await this.prisma.workflowExecutionLog.create({
                data: {
                    instanceId: instance.id,
                    stepId: node.id,
                    status: 'COMPLETED',
                    message: `Cancelled Appointment ${apptId}`
                }
            });
        }
        else if (actionType === 'add_to_waitlist') {
            const context = instance.contextData as any;
            const apptId = instance.appointmentId || context.appointmentId;

            if (apptId) {
                await this.prisma.appointment.update({
                    where: { id: apptId },
                    data: {
                        waitlistAddedAt: new Date(),
                        waitlistReason: node.data.reason || 'Workflow Action'
                    }
                });
                this.logger.log(`Added Appointment ${apptId} to waitlist`);

                await this.prisma.workflowExecutionLog.create({
                    data: {
                        instanceId: instance.id,
                        stepId: node.id,
                        status: 'COMPLETED',
                        message: `Added Appointment ${apptId} to Waitlist`
                    }
                });
            } else {
                this.logger.warn(`No appointment to add to waitlist for instance ${instance.id}`);
            }
        }
    }

    /**
     * Handle Tracking Events (Email Open / Link Click)
     */
    async handleTrackingEvent(eventType: 'EMAIL_OPENED' | 'LINK_CLICKED', data: { instanceId: string, stepId: string, templateId?: string, action?: string }) {
        this.logger.log(`Handling Tracking Event: ${eventType}`, data);

        // 1. Fetch Original Instance to get Context (Patient, Clinic, etc.)
        const instance = await this.prisma.workflowInstance.findUnique({
            where: { id: data.instanceId },
            include: { workflow: true }
        });

        if (!instance) {
            this.logger.warn(`Tracking event for unknown instance ${data.instanceId}`);
            return;
        }

        const context = instance.contextData as any;
        const patientId = instance.patientId;
        const clinicId = instance.workflow.clinicId; // Assuming workflow has clinicId linked or context has it

        // Log the interaction
        await this.prisma.workflowExecutionLog.create({
            data: {
                instanceId: instance.id,
                stepId: data.stepId,
                status: 'TRACKED',
                message: `${eventType}: ${data.templateId || data.action || ''}`
            }
        });

        // 2. Find and Trigger Workflows listening to this event
        // We need to filter by:
        // - Event Type
        // - Specific Condition (Template ID or Action Name)
        // - Clinic

        const definitions = await this.prisma.workflowDefinition.findMany({
            where: {
                triggerType: eventType,
                isActive: true,
                clinicId: clinicId || undefined
            }
        });

        for (const def of definitions) {
            // Check Granular Filter
            // We assume the Workflow Definition has config stored in `uiData` or specific fields indicating the filter.
            // For now, let's assume `uiData.triggerFilter` contains the Template ID or Action Name.

            const triggerFilter = (def.uiData as any)?.triggerFilter;
            const triggerValue = (def.uiData as any)?.triggerValue;

            let isMatch = false;

            if (eventType === 'EMAIL_OPENED') {
                // Check if workflow cares about specific template
                // If triggerValue is set, it MUST match data.templateId
                // If triggerValue is empty, it matches ANY open (optional behavior)
                if (triggerValue && triggerValue === data.templateId) {
                    isMatch = true;
                } else if (!triggerValue) {
                    isMatch = true; // Match any
                }
            } else if (eventType === 'LINK_CLICKED') {
                // Match Action Name (e.g. 'CANCEL')
                if (triggerValue && triggerValue === data.action) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                this.logger.log(`Triggering follower workflow ${def.id} on ${eventType}`);
                // Start new workflow
                // We pass original context + event specific data
                await this.startWorkflow(def.id, {
                    ...context,
                    sourceInstanceId: instance.id,
                    triggerEvent: eventType,
                    triggerData: data
                });
            }
        }
    }

    // Public method for Processor to call
    async resumeFlow(instanceId: string, fromNodeId: string) {
        const instance = await this.prisma.workflowInstance.findUnique({
            where: { id: instanceId },
            include: { workflow: true }
        });
        if (!instance) return;

        const nodes = instance.workflow.nodes as any[];
        const edges = instance.workflow.edges as any[];
        const node = nodes.find(n => n.id === fromNodeId);

        this.logger.log(`Resuming Workflow ${instanceId} from delay`);
        await this.prisma.workflowInstance.update({
            where: { id: instanceId },
            data: { status: 'RUNNING' }
        });

        // Complete the delay node transition
        await this.transitionToNext(instance, node, edges);
    }

    /**
     * Renders email/SMS templates by replacing variables with actual data
     * Supports: {{patientName}}, {{appointmentDate}}, {{appointmentTime}}, {{doctorName}}, etc.
     */
    /**
     * Renders email/SMS templates by replacing variables with actual data
     * Supports: {{patientName}}, {{appointmentDate}}, {{appointmentTime}}, {{doctorName}}, etc.
     * Also supports generic context keys like {{confirmLink}}, {{calendarLink_google}}
     */
    /**
     * Renders a string template using Handlebars
     */
    private renderTemplate(template: string, context: any): string {
        if (!template) return '';
        try {
            const compiled = Handlebars.compile(template);
            return compiled(context || {});
        } catch (error) {
            this.logger.error(`Template rendering failed: ${error.message}`);
            return template;
        }
    }

    /**
     * Evaluates a condition node
     */
    private async evaluateCondition(instance: any, node: any): Promise<boolean> {
        const data = node.data;
        const context = instance.contextData || {};
        const { variable, operator, value } = data;

        this.logger.log(`Evaluating Rule: ${variable} ${operator} ${value}`);

        // 1. Resolve Variable Value
        let actualValue = context[variable];

        if (variable === 'patientTags' && context.patientId) {
            const p = await this.prisma.patient.findUnique({ where: { id: context.patientId }, select: { tags: true } });
            actualValue = p?.tags || [];
        }

        if (actualValue === undefined || actualValue === null) {
            return false;
        }

        // 2. Compare
        switch (operator) {
            case 'EQUALS':
            case '==':
                return String(actualValue).toLowerCase() === String(value).toLowerCase();

            case 'NOT_EQUALS':
            case '!=':
                return String(actualValue).toLowerCase() !== String(value).toLowerCase();

            case 'CONTAINS':
                if (Array.isArray(actualValue)) {
                    return actualValue.includes(value);
                }
                return String(actualValue).toLowerCase().includes(String(value).toLowerCase());

            case 'GREATER_THAN':
            case '>':
                return Number(actualValue) > Number(value);

            case 'LESS_THAN':
            case '<':
                return Number(actualValue) < Number(value);

            default:
                return false;
        }
    }
}
