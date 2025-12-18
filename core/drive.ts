import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export interface DriveVideo {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    createdTime: string;
    webViewLink?: string;
    downloadUrl?: string;
}

export class GoogleDriveService {
    private drive: any;
    private folderId: string;
    private initialized: boolean = false;

    constructor(folderId: string) {
        this.folderId = folderId;
    }

    private async initializeDrive() {
        if (this.initialized) return;

        try {
            // Initialize Google Drive API
            // Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                scopes: ['https://www.googleapis.com/auth/drive.readonly'],
            });

            this.drive = google.drive({ version: 'v3', auth });
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Drive:', error);
            throw new Error('Google Drive initialization failed. Make sure GOOGLE_APPLICATION_CREDENTIALS is set.');
        }
    }

    /**
     * List all video files in the configured Drive folder
     */
    async listVideos(): Promise<DriveVideo[]> {
        await this.initializeDrive();
        
        try {
            const response = await this.drive.files.list({
                q: `'${this.folderId}' in parents and (mimeType='video/mp4' or mimeType='video/quicktime' or mimeType='video/x-msvideo') and trashed=false`,
                fields: 'files(id, name, mimeType, size, createdTime, webViewLink)',
                orderBy: 'createdTime desc',
            });

            return response.data.files.map((file: any) => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                createdTime: file.createdTime,
                webViewLink: file.webViewLink,
            }));
        } catch (error) {
            console.error('Error listing Drive videos:', error);
            throw error;
        }
    }

    /**
     * Download a video file from Drive to local storage
     */
    async downloadVideo(videoId: string, outputPath: string): Promise<string> {
        await this.initializeDrive();
        
        try {
            const filePath = path.resolve(outputPath);
            const dest = fs.createWriteStream(filePath);

            const response = await this.drive.files.get(
                { fileId: videoId, alt: 'media' },
                { responseType: 'stream' }
            );

            return new Promise((resolve, reject) => {
                response.data
                    .on('end', () => {
                        console.log(`✅ Downloaded video: ${filePath}`);
                        resolve(filePath);
                    })
                    .on('error', (err: Error) => {
                        console.error('Error downloading video:', err);
                        reject(err);
                    })
                    .pipe(dest);
            });
        } catch (error) {
            console.error('Error downloading video:', error);
            throw error;
        }
    }

    /**
     * Get video metadata
     */
    async getVideoMetadata(videoId: string): Promise<DriveVideo> {
        await this.initializeDrive();
        
        try {
            const response = await this.drive.files.get({
                fileId: videoId,
                fields: 'id, name, mimeType, size, createdTime, webViewLink',
            });

            return {
                id: response.data.id,
                name: response.data.name,
                mimeType: response.data.mimeType,
                size: response.data.size,
                createdTime: response.data.createdTime,
                webViewLink: response.data.webViewLink,
            };
        } catch (error) {
            console.error('Error getting video metadata:', error);
            throw error;
        }
    }

    /**
     * Sync videos from Drive to local assets folder
     * Downloads new videos that haven't been synced yet
     */
    async syncVideos(localAssetsPath: string = './assets/drive_videos'): Promise<string[]> {
        try {
            // Ensure local directory exists
            if (!fs.existsSync(localAssetsPath)) {
                fs.mkdirSync(localAssetsPath, { recursive: true });
            }

            const driveVideos = await this.listVideos();
            const downloadedPaths: string[] = [];

            for (const video of driveVideos) {
                const localPath = path.join(localAssetsPath, `${video.id}_${video.name}`);
                
                // Skip if already downloaded
                if (fs.existsSync(localPath)) {
                    console.log(`⏭️  Skipping ${video.name} (already exists)`);
                    continue;
                }

                console.log(`📥 Downloading ${video.name}...`);
                await this.downloadVideo(video.id, localPath);
                downloadedPaths.push(localPath);
            }

            return downloadedPaths;
        } catch (error) {
            console.error('Error syncing videos:', error);
            throw error;
        }
    }
}

