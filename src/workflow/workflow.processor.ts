import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WorkflowOrchestrator } from './workflow.orchestrator';

@Processor('workflow-queue')
export class WorkflowProcessor extends WorkerHost {
    private readonly logger = new Logger(WorkflowProcessor.name);

    constructor(private workflowOrchestrator: WorkflowOrchestrator) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing Job ${job.id} of type ${job.name}`);

        switch (job.name) {
            case 'resume-workflow':
                await this.handleResumeWorkflow(job.data);
                break;
            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }

    private async handleResumeWorkflow(data: { instanceId: string; nextNodeId: string }) {
        const { instanceId, nextNodeId } = data;
        this.logger.log(`Resuming Workflow Instance ${instanceId} from node ${nextNodeId}`);

        // We pass the 'delayed' node ID back to orchestrator, which will then move to *next*
        // Logic: The job was scheduled *by* the delay node. So 'nextNodeId' is actually the delay node ID itself
        // and the orchestrator's 'resumeFlow' will find the outgoing edges from it.
        await this.workflowOrchestrator.resumeFlow(instanceId, nextNodeId);
    }
}
