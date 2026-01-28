import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { EhrService } from './ehr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';

@Controller('ehr')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EhrController {
    constructor(private readonly ehrService: EhrService) { }

    @Get('health')
    @Public()
    healthCheck() {
        return { status: 'ok', module: 'EhrModule', timestamp: new Date().toISOString() };
    }

    // --- VITALS ---
    @Get('patients/:id/vitals')
    getVitals(@Param('id') patientId: string, @Req() req: any) {
        return this.ehrService.getVitals(patientId, req.user);
    }

    @Post('patients/:id/vitals')
    addVitals(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.addVitals(patientId, data, req.user);
    }

    // --- DIAGNOSES ---
    @Get('patients/:id/diagnoses')
    getDiagnoses(@Param('id') patientId: string, @Req() req: any) {
        return this.ehrService.getDiagnoses(patientId, req.user);
    }

    @Post('patients/:id/diagnoses')
    addDiagnosis(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.addDiagnosis(patientId, data, req.user);
    }

    // --- MEDICATIONS ---
    @Get('patients/:id/medications')
    getMedications(@Param('id') patientId: string, @Req() req: any) {
        return this.ehrService.getMedications(patientId, req.user);
    }

    @Post('patients/:id/medications')
    addMedication(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.addMedication(patientId, data, req.user);
    }

    @Patch('medications/:id')
    updateMedication(@Param('id') medId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.updateMedication(medId, data, req.user);
    }

    // --- ALLERGIES ---
    @Get('patients/:id/allergies')
    getAllergies(@Param('id') patientId: string, @Req() req: any) {
        return this.ehrService.getAllergies(patientId, req.user);
    }

    @Post('patients/:id/allergies')
    addAllergy(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.addAllergy(patientId, data, req.user);
    }

    @Patch('allergies/:id')
    updateAllergy(@Param('id') allergyId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.updateAllergy(allergyId, data, req.user);
    }

    // --- ENCOUNTERS ---
    @Get('patients/:id/encounters')
    getEncounters(@Param('id') patientId: string, @Req() req: any) {
        return this.ehrService.getEncounters(patientId, req.user);
    }

    @Post('patients/:id/encounters')
    createEncounter(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.createEncounter(patientId, data, req.user);
    }

    @Patch('encounters/:id')
    updateEncounter(@Param('id') encounterId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.updateEncounter(encounterId, data, req.user);
    }

    @Post('encounters/:id/finalize')
    finalizeEncounter(@Param('id') encounterId: string, @Req() req: any) {
        return this.ehrService.finalizeEncounter(encounterId, req.user);
    }

    // --- OBSERVATIONS ---
    @Get('patients/:id/observations/latest')
    getLatestObservations(@Param('id') patientId: string, @Req() req: any) {
        return this.ehrService.getLatestPatientObservations(patientId, req.user);
    }

    @Get('patients/:id/observations/history/:type')
    getObservationHistory(
        @Param('id') patientId: string,
        @Param('type') type: string,
        @Req() req: any
    ) {
        return this.ehrService.getPatientObservationHistory(patientId, type, req.user);
    }

    @Post('patients/:id/observations')
    createObservation(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.createObservation(patientId, data, req.user);
    }

    @Post('patients/:id/observations/bulk')
    bulkCreateObservations(@Param('id') patientId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.bulkCreateObservations(patientId, data.observations, req.user);
    }

    @Post('observations/:id/amend')
    amendObservation(@Param('id') observationId: string, @Body() data: any, @Req() req: any) {
        return this.ehrService.amendObservation(observationId, data, req.user);
    }

    @Get('encounters/:id/observations')
    getEncounterObservations(@Param('id') encounterId: string, @Req() req: any) {
        return this.ehrService.getEncounterObservations(encounterId, req.user);
    }
}
