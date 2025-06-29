import { Injectable } from '@nestjs/common';
import * as path from 'path'
import * as fs from 'fs'
import {v4 as uuidv4} from "uuid";

@Injectable()
export class UploaderService {
    async deleteImages(imagePaths: string[]): Promise<void> {
        for (const imagePath of imagePaths) {
            await this.deleteImage(imagePath)
        }
    }

    async deleteImage(imagePath: string): Promise<void> {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }

    async uploadImages(dir: string, files: Express.Multer.File[]): Promise<string[]> {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', dir);
        const uploadedPaths: string[] = [];

        try {
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for (const file of files) {
                const fileExt = path.extname(file.originalname);
                const fileName = `${uuidv4()}${fileExt}`;
                const filePath = path.join(uploadDir, fileName);
                const relativePath = path.join('uploads', dir, fileName).replace(/\\/g, '/');
                console.log(file)
                await fs.promises.writeFile(filePath, file.buffer);
                uploadedPaths.push(`/${relativePath}`);
            }

            return uploadedPaths;
        } catch (error) {
            // Удаляем уже загруженные файлы в случае ошибки
            for (const filePath of uploadedPaths) {
                const fullPath = path.join(process.cwd(), filePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
            throw new Error(`Ошибка загрузки файлов: ${error.message}`);
        }
    }

    uploadImage(dir: string, file: Express.Multer.File): string {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', dir);
        const fileExt = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);
        const relativePath = path.join('uploads', dir, fileName).replace(/\\/g, '/');

        try {
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            fs.writeFileSync(filePath, file.buffer);
            return `/${relativePath}`;
        } catch (error) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw new Error(`Ошибка загрузки файлов: ${error.message}`);
        }
    }
}