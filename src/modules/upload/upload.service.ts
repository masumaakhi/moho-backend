import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'mohul/products',
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(new Error('Upload failed: result is undefined'));
          resolve(result.secure_url);
        },
      );

      upload.end(file.buffer);
    });
  }
}
