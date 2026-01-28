import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Public } from '../common/public.decorator';

@Controller('files')
export class FilesController {
    @Public()
    @Post('upload/public')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/public',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return cb(null, `${randomName}${extname(file.originalname)}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            // Allow image, pdf, doc, docx
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
            const ext = extname(file.originalname).toLowerCase();
            if (allowedExtensions.includes(ext)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Invalid file type. Allowed types: jpg, jpeg, png, pdf, doc, docx'), false);
            }
        },
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        }
    }))
    async uploadFile(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        const fileUrl = `/uploads/public/${file.filename}`;
        return {
            url: fileUrl,
            fileName: file.originalname,
            size: file.size,
            mimetype: file.mimetype
        };
    }
}
