# Google Drive Setup

Ovaj dokument objašnjava kako da podesite Google Drive integraciju za pullovanje videa.

## Setup

### 1. Kreiraj Google Cloud Project

1. Idite na [Google Cloud Console](https://console.cloud.google.com/)
2. Kreirajte novi projekat ili izaberite postojeći
3. Omogućite **Google Drive API**:
   - Idite na "APIs & Services" > "Library"
   - Pretražite "Google Drive API"
   - Kliknite "Enable"

### 2. Kreiraj Service Account

1. Idite na "APIs & Services" > "Credentials"
2. Kliknite "Create Credentials" > "Service Account"
3. Unesite ime (npr. "tt-printer-drive")
4. Kliknite "Create and Continue"
5. Preskoči "Grant users access" (ne treba)
6. Kliknite "Done"

### 3. Download Service Account Key

1. Kliknite na kreirani service account
2. Idite na "Keys" tab
3. Kliknite "Add Key" > "Create new key"
4. Izaberi "JSON"
5. Download-uj JSON fajl

### 4. Podesi Environment Variable

Postavi `GOOGLE_APPLICATION_CREDENTIALS` environment variable na putanju do JSON fajla:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

Ili dodaj u `.env` fajl:
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
```

### 5. Share Drive Folder sa Service Account

1. Otvori Google Drive folder gde ćeš kačiti klipove
2. Klikni "Share" (Podeli)
3. U "Add people and groups" unesi email adresu service account-a (nalazi se u JSON fajlu kao `client_email`)
4. Daj "Viewer" permisije
5. Klikni "Send"

### 6. Dobij Folder ID

1. Otvori folder u Google Drive-u
2. URL će biti nešto kao: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
3. Kopiraj `FOLDER_ID_HERE` - to je tvoj folder ID

### 7. Koristi u Kodu

```typescript
import { GoogleDriveService } from './core/drive';

// Inicijalizuj servis sa folder ID-om
const driveService = new GoogleDriveService('YOUR_FOLDER_ID_HERE');

// Listuj sve video fajlove
const videos = await driveService.listVideos();
console.log('Found videos:', videos);

// Sync-uj sve nove video fajlove
const downloaded = await driveService.syncVideos('./assets/drive_videos');
console.log('Downloaded:', downloaded);

// Download specifičan video
await driveService.downloadVideo('video_id', './output/video.mp4');
```

## Folder Structure

Nakon sync-a, video fajlovi će biti sačuvani u:
```
assets/drive_videos/
  ├── VIDEO_ID_1_video_name.mp4
  ├── VIDEO_ID_2_another_video.mp4
  └── ...
```

## Notes

- Service Account ima samo "readonly" pristup (ne može da upload-uje ili briše)
- Video fajlovi se download-uju samo jednom (preskače ako već postoje lokalno)
- Podržani formati: MP4, QuickTime, AVI


