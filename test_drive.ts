import { GoogleDriveService } from './core/drive';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function testDrive() {
    console.log("🚗 Testing Google Drive Integration...\n");
    
    // Check environment variables
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    console.log("📋 Configuration:");
    console.log(`  GOOGLE_APPLICATION_CREDENTIALS: ${credentialsPath || '❌ NOT SET'}`);
    console.log(`  GOOGLE_DRIVE_FOLDER_ID: ${folderId || '❌ NOT SET'}`);
    console.log();
    
    if (!credentialsPath) {
        console.error("❌ GOOGLE_APPLICATION_CREDENTIALS environment variable is not set!");
        console.error("   Set it in your .env file or export it:");
        console.error(`   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"`);
        process.exit(1);
    }
    
    if (!folderId) {
        console.error("❌ GOOGLE_DRIVE_FOLDER_ID environment variable is not set!");
        console.error("   Set it in your .env file:");
        console.error(`   GOOGLE_DRIVE_FOLDER_ID="your-folder-id-here"`);
        process.exit(1);
    }
    
    // Check if credentials file exists
    const fs = require('fs');
    if (!fs.existsSync(credentialsPath)) {
        console.error(`❌ Credentials file not found: ${credentialsPath}`);
        process.exit(1);
    }
    
    console.log("✅ Configuration looks good!\n");
    
    try {
        // Initialize service
        console.log("🔧 Initializing Google Drive service...");
        const driveService = new GoogleDriveService(folderId);
        console.log("✅ Service initialized\n");
        
        // Test 1: List videos
        console.log("📹 Test 1: Listing videos in folder...");
        console.log(`   Folder ID: ${folderId}\n`);
        
        const videos = await driveService.listVideos();
        
        console.log(`✅ Found ${videos.length} video(s):\n`);
        
        if (videos.length === 0) {
            console.log("⚠️  No videos found in the folder.");
            console.log("   Make sure:");
            console.log("   1. The folder ID is correct");
            console.log("   2. The folder contains video files (MP4, MOV, AVI)");
            console.log("   3. The Service Account email has access to the folder");
        } else {
            videos.forEach((video, index) => {
                console.log(`  ${index + 1}. ${video.name}`);
                console.log(`     ID: ${video.id}`);
                console.log(`     Size: ${video.size ? (parseInt(video.size) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
                console.log(`     Type: ${video.mimeType}`);
                console.log(`     Created: ${video.createdTime}`);
                console.log();
            });
            
            // Test 2: Download first video (small test)
            if (videos.length > 0) {
                const testVideo = videos[0];
                console.log(`📥 Test 2: Downloading test video (${testVideo.name})...`);
                
                const testOutputDir = path.resolve(__dirname, './assets/drive_videos');
                if (!fs.existsSync(testOutputDir)) {
                    fs.mkdirSync(testOutputDir, { recursive: true });
                }
                
                const testOutputPath = path.join(testOutputDir, `TEST_${testVideo.id}_${testVideo.name}`);
                
                // Skip if already exists
                if (fs.existsSync(testOutputPath)) {
                    console.log(`⏭️  Test file already exists: ${testOutputPath}`);
                    console.log("   (Delete it to re-download)");
                } else {
                    await driveService.downloadVideo(testVideo.id, testOutputPath);
                    console.log(`✅ Test download successful: ${testOutputPath}`);
                }
            }
        }
        
        console.log("\n✅ All tests completed successfully!");
        
    } catch (error: any) {
        console.error("\n❌ Error occurred:");
        console.error("   Message:", error.message);
        
        if (error.code === 403) {
            console.error("\n🔒 403 Forbidden Error:");
            console.error("   This usually means:");
            console.error("   1. Google Drive API is not enabled in your Google Cloud project");
            console.error("      → Enable it at: https://console.cloud.google.com/apis/library/drive.googleapis.com");
            console.error("   2. The Service Account doesn't have access to the folder");
            console.error("      → Share the folder with the Service Account email (found in JSON file)");
        } else if (error.code === 404) {
            console.error("\n🔍 404 Not Found Error:");
            console.error("   The folder ID might be incorrect, or the folder doesn't exist.");
        } else if (error.code === 'ENOENT') {
            console.error("\n📁 File Not Found Error:");
            console.error("   The credentials file path is incorrect.");
        }
        
        if (error.response) {
            console.error("\n   Status:", error.response.status);
            console.error("   Response:", JSON.stringify(error.response.data, null, 2));
        }
        
        process.exit(1);
    }
}

testDrive().catch(console.error);
