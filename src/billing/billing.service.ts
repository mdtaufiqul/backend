
import { Injectable } from '@nestjs/common';

@Injectable()
export class BillingService {
    private invoices = [
        { id: 'INV-001', patientName: 'Sarah Connor', date: '2025-10-24', amount: 150.00, status: 'paid' },
        { id: 'INV-002', patientName: 'John Smith', date: '2025-10-25', amount: 85.50, status: 'pending' },
        { id: 'INV-003', patientName: 'Emily Doe', date: '2025-10-26', amount: 200.00, status: 'overdue' },
    ];

    async getInvoices(clinicId: string) {
        // In a real app, filter by clinicId
        return this.invoices;
    }

    async getStats(clinicId: string) {
        const totalRevenue = this.invoices.reduce((acc, curr) => curr.status === 'paid' ? acc + curr.amount : acc, 0);
        const outstanding = this.invoices.reduce((acc, curr) => curr.status !== 'paid' ? acc + curr.amount : acc, 0);
        return {
            totalRevenue,
            outstanding,
            collectionRate: 94.2
        };
    }

    async createInvoice(clinicId: string, data: any) {
        const newInvoice = {
            id: `INV-${Math.floor(Math.random() * 1000)}`,
            ...data,
            date: new Date().toISOString().split('T')[0]
        };
        this.invoices.unshift(newInvoice);
        return newInvoice;
    }
}
