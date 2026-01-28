
import axios from 'axios';

const API_URL = 'http://127.0.0.1:3001/api';

export class ApiClient {
    private token: string | null = null;
    private baseUrl: string;

    constructor(baseUrl: string = 'http://127.0.0.1:3001/api') {
        this.baseUrl = baseUrl;
    }

    async post(path: string, data: any) {
        const headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
        try {
            const response = await axios.post(`${this.baseUrl}${path}`, data, { headers });
            return response.data;
        } catch (error: any) {
            console.error(`POST ${path} failed:`, error.response?.data || error.message);
            throw error;
        }
    }

    async get(path: string) {
        const headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
        try {
            const response = await axios.get(`${this.baseUrl}${path}`, { headers });
            return response.data;
        } catch (error: any) {
            console.error(`GET ${path} failed:`, error.response?.data || error.message);
            throw error;
        }
    }

    setToken(token: string) {
        this.token = token;
    }

    async login(email: string, password: string, role?: string) {
        const data: any = { email, password };
        if (role) data.role = role;

        const response = await this.post('/auth/login', data);
        if (response.token) {
            this.setToken(response.token);
        }
        return response;
    }

    async patch(path: string, data: any) {
        const headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
        try {
            const response = await axios.patch(`${this.baseUrl}${path}`, data, { headers });
            return response.data;
        } catch (error: any) {
            console.error(`PATCH ${path} failed:`, error.response?.data || error.message);
            throw error;
        }
    }

    async delete(path: string) {
        const headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
        try {
            const response = await axios.delete(`${this.baseUrl}${path}`, { headers });
            return response.data;
        } catch (error: any) {
            console.error(`DELETE ${path} failed:`, error.response?.data || error.message);
            throw error;
        }
    }
}
