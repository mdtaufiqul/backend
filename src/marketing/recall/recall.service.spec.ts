
import { Test, TestingModule } from '@nestjs/testing';
import { RecallService } from './recall.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../services/ai.service';
import { SmsSenderService } from '../../services/sms-sender.service';

describe('RecallService', () => {
    let service: RecallService;
    let prisma: PrismaService;
    let aiService: AiService;
    let smsService: SmsSenderService;

    const mockPrisma = {
        patient: {
            findMany: jest.fn(),
        },
        recallOpportunity: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockAi = {
        generateNotes: jest.fn().mockResolvedValue('Mocked AI Message'),
    };

    const mockSms = {
        sendSms: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecallService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: AiService, useValue: mockAi },
                { provide: SmsSenderService, useValue: mockSms },
            ],
        }).compile();

        service = module.get<RecallService>(RecallService);
        prisma = module.get<PrismaService>(PrismaService);
        aiService = module.get<AiService>(AiService);
        smsService = module.get<SmsSenderService>(SmsSenderService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('scanForOpportunities', () => {
        it('should generate opportunities for patients with old appointments', async () => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 7);

            mockPrisma.patient.findMany.mockResolvedValue([
                {
                    id: 'p1',
                    name: 'John Doe',
                    appointments: [{ date: sixMonthsAgo.toISOString(), type: 'Consultation' }],
                },
            ]);

            const result = await service.scanForOpportunities();

            expect(result.generated).toBe(1);
            expect(mockPrisma.recallOpportunity.create).toHaveBeenCalled();
        });

        it('should skip patients with recent appointments', async () => {
            const recentDate = new Date();
            recentDate.setMonth(recentDate.getMonth() - 1);

            mockPrisma.patient.findMany.mockResolvedValue([
                {
                    id: 'p2',
                    name: 'Jane Smith',
                    appointments: [{ date: recentDate.toISOString(), type: 'Follow-up' }],
                },
            ]);

            const result = await service.scanForOpportunities();

            expect(result.generated).toBe(0);
        });
    });

    describe('sendRecall', () => {
        it('should send SMS and update status', async () => {
            const mockOpp = {
                id: 'opp1',
                draftMessage: 'Checkup time!',
                patient: {
                    name: 'John Doe',
                    phone: '+123456789',
                    appointments: [{ doctorId: 'doc1' }]
                }
            };

            mockPrisma.recallOpportunity.findUnique.mockResolvedValue(mockOpp);
            mockPrisma.recallOpportunity.update.mockResolvedValue({ status: 'SENT' });

            const result = await service.sendRecall('opp1');

            expect(smsService.sendSms).toHaveBeenCalledWith('+123456789', 'Checkup time!', 'doc1');
            expect(result.status).toBe('SENT');
        });
    });
});
