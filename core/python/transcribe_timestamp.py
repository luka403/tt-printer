from faster_whisper import WhisperModel
import json
import sys
import os

def transcribe_audio(audio_path, output_path, device="cpu"):
    print(f"Loading WhisperModel on {device}...")
    try:
        # Use 'tiny' or 'small' for speed on CPU, 'medium' for better accuracy
        # int8 is faster on CPU
        model = WhisperModel("small", device=device, compute_type="int8")
    except Exception as e:
        print(f"Error loading model: {e}")
        return False

    print(f"Transcribing {audio_path}...")
    try:
        segments, info = model.transcribe(
            audio_path,
            word_timestamps=True,
            beam_size=5
        )

        words = []
        for segment in segments:
            if segment.words:
                for w in segment.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3)
                    })
        
        # Save to JSON
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
            
        print(f"Saved {len(words)} words to {output_path}")
        return True

    except Exception as e:
        print(f"Transcription error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python transcribe_timestamp.py <input_audio> <output_json>")
        sys.exit(1)
        
    audio_input = sys.argv[1]
    json_output = sys.argv[2]
    
    if not os.path.exists(audio_input):
        print(f"Error: Audio file not found: {audio_input}")
        sys.exit(1)
        
    # Check for CUDA
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    success = transcribe_audio(audio_input, json_output, device)
    
    if not success:
        sys.exit(1)

