import sys
import os
import json
import torch
import whisperx
import math

def to_ass_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def generate_karaoke_ass(audio_path, output_ass_path, device="cpu"):
    print(f"Loading WhisperX model on {device}...")
    
    # Load model
    try:
        model = whisperx.load_model(
            "large-v2", # v3 might be too heavy, v2 is standard good
            device=device,
            compute_type="int8" # CPU friendly
        )
    except Exception as e:
        print(f"Error loading model: {e}")
        return False

    print(f"Transcribing {audio_path}...")
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=4) # Smaller batch for CPU

    print("Aligning...")
    # Load alignment model
    model_a, metadata = whisperx.load_align_model(
        language_code=result["language"],
        device=device
    )

    aligned_result = whisperx.align(
        result["segments"],
        model_a,
        metadata,
        audio,
        device,
        return_char_alignments=False
    )

    # Collect all words
    words = []
    for segment in aligned_result["segments"]:
        for word in segment.get("words", []):
            if "start" in word and "end" in word:
                words.append({
                    "text": word["word"].strip(),
                    "start": word["start"],
                    "end": word["end"]
                })

    if not words:
        print("No words found!")
        return False

    # Logic for Viral Timing
    MIN_DURATION = 0.18
    HOOK_BOOST = 1.3
    
    # Emotional/Impact words for highlighting
    HOOK_WORDS = {
        "brain", "secret", "nobody", "never", "hidden", "automatic", 
        "this", "real", "inside", "shocking", "money", "die", "live",
        "love", "hate", "stop", "facts", "history", "science"
    }

    processed_words = []
    
    # Process word timings
    for i, w in enumerate(words):
        start = w["start"]
        end = w["end"]
        duration = end - start
        
        # Enforce min duration
        if duration < MIN_DURATION:
            end = start + MIN_DURATION
            
        # Overlap slightly (no gaps)
        if i < len(words) - 1:
            next_start = words[i+1]["start"]
            if end < next_start:
                end = next_start # Close the gap
            # If overlap is too big, trim? No, keeping previous word longer is usually better.
            
        # Hook word boost (extend duration visual effect? or just logic check)
        is_hook_word = w["text"].lower().replace(r'[^\w]', '') in HOOK_WORDS
        
        # If it's a hook word, we might want to emphasize it in style, not necessarily duration
        # But user script said: "end = start + (end-start)*HOOK_BOOST"
        # This extends the end time.
        if is_hook_word:
            end = start + (end - start) * HOOK_BOOST

        processed_words.append({
            "text": w["text"],
            "start": start,
            "end": end,
            "is_hook": is_hook_word
        })

    # Generate ASS Content
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,85,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,5,10,10,550,1
Style: Highlight,Arial,95,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,0,5,10,10,550,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    ass_lines = []
    
    for w in processed_words:
        start_time = to_ass_time(w["start"])
        end_time = to_ass_time(w["end"])
        
        clean_text = w["text"].upper() # ALL CAPS
        
        # Determine Style
        style = "Default"
        if w["is_hook"] or len(clean_text) > 6 or any(char.isdigit() for char in clean_text):
            style = "Highlight" # Yellow
            
        # Animation: Scale/Pop
        # \fscx120\fscy120 starts at 120% scale
        # \t(0,120,\fscx100\fscy100) animates to 100% over 120ms
        anim = r"{\fscx120\fscy120\t(0,150,\fscx100\fscy100)}"
        
        line = f"Dialogue: 0,{start_time},{end_time},{style},,0,0,0,,{anim}{clean_text}"
        ass_lines.append(line)

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(ass_lines))
        
    print(f"Generated ASS file: {output_ass_path}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_karaoke.py <input_audio> <output_ass>")
        sys.exit(1)
        
    audio_input = sys.argv[1]
    ass_output = sys.argv[2]
    
    if not os.path.exists(audio_input):
        print(f"Error: Audio file not found: {audio_input}")
        sys.exit(1)
        
    device = "cuda" if torch.cuda.is_available() else "cpu"
    success = generate_karaoke_ass(audio_input, ass_output, device)
    
    if not success:
        sys.exit(1)

