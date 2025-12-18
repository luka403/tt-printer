import { db } from './core/db';

console.log("📚 All Generated Stories:\n");
console.log("=".repeat(70));

const videos = db.query("SELECT id, title, script_content, created_at FROM videos ORDER BY id DESC");

if (videos.length === 0) {
    console.log("No stories found in database.");
} else {
    videos.forEach((video: any, index: number) => {
        console.log(`\n📖 Story #${video.id} - ${video.title}`);
        console.log(`   Created: ${video.created_at}`);
        console.log("─".repeat(70));
        console.log(video.script_content);
        console.log("─".repeat(70));
        console.log(`   Length: ${video.script_content.length} characters`);
        console.log(`   Words: ${video.script_content.split(' ').length}`);
    });
}

console.log("\n" + "=".repeat(70));
console.log(`\nTotal stories: ${videos.length}`);










