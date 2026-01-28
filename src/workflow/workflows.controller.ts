import { Controller, Get, Post, Body, Patch, Put, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('workflows')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowsController {
    constructor(private readonly prisma: PrismaService) { }

    @Post()
    @Permissions('manage_workflows')
    async create(@Body() createWorkflowDto: any, @Request() req) {
        const { clinicId } = req.user;

        return this.prisma.workflowDefinition.create({
            data: {
                ...createWorkflowDto,
                clinicId: clinicId || createWorkflowDto.clinicId || undefined, // Bind to clinic if exists, or use DTO
                steps: {
                    create: createWorkflowDto.steps?.map((step, index) => ({
                        order: index,
                        type: step.type,
                        delayMinutes: step.delayMinutes,
                        channel: step.channel,
                        templateId: step.templateId
                    }))
                }
            },
            include: {
                steps: true
            }
        });
    }

    @Get()
    @Permissions('view_workflows')
    async findAll(@Request() req) {
        const { clinicId, role, userId } = req.user;
        const where: any = {};

        if (clinicId) {
            where.clinicId = clinicId;
        } else if (role !== 'SYSTEM_ADMIN') {
            // If no clinic and not system admin, what do we show?
            // Likely nothing or empty
            return [];
        }

        return this.prisma.workflowDefinition.findMany({
            where,
            include: {
                steps: true,
                instances: {
                    where: { status: 'RUNNING' },
                    take: 5 // Just peek at active instances
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    @Get(':id')
    @Permissions('view_workflows')
    findOne(@Param('id') id: string) {
        return this.prisma.workflowDefinition.findUnique({
            where: { id },
            include: {
                steps: {
                    include: { template: true },
                    orderBy: { order: 'asc' }
                }
            }
        });
    }

    @Patch(':id')
    @Permissions('manage_workflows')
    async patch(@Param('id') id: string, @Body() updateWorkflowDto: any) {
        return this.update(id, updateWorkflowDto);
    }

    @Put(':id')
    @Permissions('manage_workflows')
    async put(@Param('id') id: string, @Body() updateWorkflowDto: any) {
        return this.update(id, updateWorkflowDto);
    }

    private async update(id: string, updateWorkflowDto: any) {
        // Transactional update for steps
        return this.prisma.$transaction(async (tx) => {
            // 1. Update basic fields
            const { steps, ...basicData } = updateWorkflowDto;
            await tx.workflowDefinition.update({
                where: { id },
                data: basicData
            });

            // 2. Re-create steps if provided
            if (steps) {
                await tx.workflowStep.deleteMany({ where: { workflowId: id } });
                await tx.workflowStep.createMany({
                    data: steps.map((step, index) => ({
                        workflowId: id,
                        order: index,
                        type: step.type,
                        delayMinutes: step.delayMinutes,
                        channel: step.channel,
                        templateId: step.templateId
                    }))
                });
            }

            return tx.workflowDefinition.findUnique({
                where: { id },
                include: { steps: true }
            });
        });
    }

    @Delete(':id')
    @Permissions('manage_workflows')
    remove(@Param('id') id: string) {
        return this.prisma.workflowDefinition.delete({
            where: { id }
        });
    }
}
