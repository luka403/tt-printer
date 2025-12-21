import { GoogleDriveService } from '../core/drive';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    console.log("📥 Starting Google Drive Video Sync...");
    
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!folderId) {
        console.error("❌ Error: GOOGLE_DRIVE_FOLDER_ID is not set in .env file.");
        process.exit(1);
    }

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error("❌ Error: GOOGLE_APPLICATION_CREDENTIALS is not set in .env file.");
        process.exit(1);
    }

    try {
        const driveService = new GoogleDriveService(folderId);
        
        // Define local path for videos
        const localPath = path.resolve(__dirname, '../assets/drive_videos');
        
        console.log(`📂 Syncing from Drive Folder ID: ${folderId}`);
        console.log(`💾 Target Local Directory: ${localPath}`);
        
        const downloadedFiles = await driveService.syncVideos(localPath);
        
        console.log("\n" + "=".repeat(50));
        console.log(`✅ Sync Completed!`);
        console.log(`📥 New files downloaded: ${downloadedFiles.length}`);
        if (downloadedFiles.length > 0) {
            downloadedFiles.forEach(f => console.log(`   - ${path.basename(f)}`));
        }
        console.log("=".repeat(50));

    } catch (error: any) {
        console.error("\n❌ Sync Failed:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);

