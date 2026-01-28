export class CreateClinicDto {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    description?: string;
    logo?: string;
    timezone?: string;
    mapLink?: string;
    mapPin?: string;
}
