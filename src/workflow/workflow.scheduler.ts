import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowOrchestrator } from './workflow.orchestrator';
import { addHours, subMinutes, addMinutes, startOfMinute, endOfMinute } from 'date-fns';

@Injectable()
export class WorkflowScheduler {
    private readonly logger = new Logger(WorkflowScheduler.name);

    constructor(
        private prisma: PrismaService,
        private orchestrator: WorkflowOrchestrator
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        // this.logger.debug('Checking for time-based workflow triggers...');

        const activeWorkflows = await this.prisma.workflowDefinition.findMany({
            where: { isActive: true }
        });

        for (const def of activeWorkflows) {
            try {
                // Parse nodes to find Trigger Time Condition
                let nodes: any[] = [];
                if (typeof def.nodes === 'string') {
                    nodes = JSON.parse(def.nodes);
                } else {
                    nodes = def.nodes as any[];
                }

                const triggerNode = nodes.find(n => n.type === 'trigger');

                // New Format: Check for timingDirection
                if (triggerNode?.data?.timingDirection && triggerNode.data.timingDirection !== 'IMMEDIATE') {
                    await this.processCondition(def, triggerNode);
                }
                // Legacy Format Fallback
                else if (triggerNode?.data?.timeCondition && triggerNode.data.timeCondition !== 'IMMEDIATE') {
                    // We can map legacy strings if needed, but for now we focus on new format
                    // e.g. BEFORE_24H -> map to node structure and pass to processCondition
                    // But to avoid complexity, letting legacy logic slide for now unless requested.
                }

            } catch (err) {
                this.logger.error(`Error processing workflow ${def.id}:`, err);
            }
        }
    }

    private async processCondition(def: any, triggerNode: any) {
        const direction = triggerNode.data.timingDirection;
        const value = triggerNode.data.timingValue;
        const unit = triggerNode.data.timingUnit;

        if (!direction || direction === 'IMMEDIATE') return;
        if (!value || !unit) return;

        const now = new Date();
        let targetStart: Date;

        // Calculate offset in minutes
        let offsetMinutes = 0;
        if (unit === 'MINUTES') offsetMinutes = value;
        else if (unit === 'HOURS') offsetMinutes = value * 60;
        else if (unit === 'DAYS') offsetMinutes = value * 1440;

        if (direction === 'BEFORE') {
            // "Before 2h" -> Trigger Now IF Appointment is at Now + 2h
            targetStart = addMinutes(startOfMinute(now), offsetMinutes);
        } else if (direction === 'AFTER') {
            // "After 2h" -> Trigger Now IF Appointment was at Now - 2h
            // (Wait, if I want to trigger AFTER, I look for appointments in the PAST)
            targetStart = subMinutes(startOfMinute(now), offsetMinutes);
        } else {
            return;
        }

        const targetEnd = addMinutes(targetStart, 15); // Broaden window

        // Find qualifying appointments
        const appointments = await this.prisma.appointment.findMany({
            where: {
                date: {
                    gte: targetStart,
                    lte: targetEnd
                },
                status: {
                    in: ['scheduled', 'completed'] // For AFTER triggers, it might be completed
                }
            }
        });

        if (appointments.length > 0) {
            this.logger.log(`Found ${appointments.length} appointments for '${direction} ${value} ${unit}' trigger (Workflow: ${def.name})`);
        }

        for (const appt of appointments) {
            // Check for duplicate execution
            const existing = await this.prisma.workflowInstance.findFirst({
                where: {
                    workflowId: def.id,
                    appointmentId: appt.id
                }
            });

            if (!existing && appt.patientId) {
                this.logger.log(`>> Triggering Workflow '${def.name}' for Appointment ${appt.id}`);
                await this.orchestrator.startWorkflow(def.id, {
                    patientId: appt.patientId,
                    appointmentId: appt.id,
                    trigger: `${direction}_${value}_${unit}`
                });
            }
        }
    }

    /**
     * Polls for workflows that are in WAITING status and are due to run
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async processScheduledSteps() {
        const now = new Date();

        // Find instances waiting for a delay that has passed
        const dueInstances = await this.prisma.workflowInstance.findMany({
            where: {
                status: 'WAITING',
                nextRunAt: {
                    lte: now
                }
            }
        });

        if (dueInstances.length > 0) {
            this.logger.log(`Found ${dueInstances.length} due delayed workflows`);
        }

        for (const instance of dueInstances) {
            try {
                this.logger.log(`Resuming delayed instance ${instance.id}`);

                // Clear the schedule first to prevent double processing in case of crash/race
                // (Though strictly we should do this effectively transactionally or optimistically)
                await this.prisma.workflowInstance.update({
                    where: { id: instance.id },
                    data: { nextRunAt: null, status: 'RUNNING' }
                });

                if (instance.currentNodeId) {
                    await this.orchestrator.resumeFlow(instance.id, instance.currentNodeId);
                } else {
                    this.logger.warn(`Instance ${instance.id} has no currentNodeId but was WAITING`);
                }
            } catch (err) {
                this.logger.error(`Failed to resume instance ${instance.id}:`, err);
            }
        }
    }
}
