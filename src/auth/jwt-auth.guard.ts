import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('No token provided');
        }

        const [type, token] = authHeader.split(' ');

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid token format');
        }

        try {
            const secret = process.env.JWT_SECRET || 'supersecret';
            const decoded = jwt.verify(token, secret) as any;

            // Match the payload structure from AuthService: { userId, email, role }
            request.user = {
                id: decoded.userId,
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                clinicId: decoded.clinicId,
                permissions: decoded.permissions,
                activeRoleId: decoded.activeRoleId,
                profileType: decoded.profileType
            };

            return true;
        } catch (err) {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
