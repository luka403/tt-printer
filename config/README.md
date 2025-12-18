# 📝 Prompt Configuration

Svi promptovi su centralizovani u `config/prompts.ts` fajlu za lakše menjanje i održavanje.

## 📁 Struktura

### `SceneAnalysisPrompts`
- **systemPrompt**: System prompt za LLM analizu scena iz priče
- **userPromptTemplate**: Template za user prompt (koristi `{niche}` i `{script}`)

### `ImageStylePrompts`
- **nicheStyles**: Style base promptovi za različite niche-ove (scary_stories, motivation, itd.)
- **styleEnhancements**: Style enhancement promptovi za image generation (simple_cartoon, anime, itd.)
- **defaultNegativePrompt**: Default negative prompt za image generation

### `ScaryStoryPrompts`
- **systemPrompt**: System prompt za generisanje scary stories
- **userPromptTemplate**: Template za user prompt (koristi `{theme}`)
- **retryPromptTemplate**: Template za retry prompt kada se detektuje duplikat
- **themes**: Lista dostupnih tema za scary stories

### `ContentPrompts`
- **genericSystemPrompt**: Generic system prompt za content generation
- **genericUserPromptTemplate**: Generic user prompt template

## 🔧 Kako da Menjaš Promptove

### Primer 1: Promena Style-a za Scary Stories

U `config/prompts.ts`:
```typescript
nicheStyles: {
    scary_stories: 'YOUR NEW STYLE PROMPT HERE',
    // ...
}
```

### Primer 2: Dodavanje Novog Style-a

U `config/prompts.ts`:
```typescript
styleEnhancements: {
    // ...
    my_custom_style: 'my custom style description',
    // ...
}
```

### Primer 3: Promena System Prompta za Scene Analysis

U `config/prompts.ts`:
```typescript
export const SceneAnalysisPrompts = {
    systemPrompt: `YOUR NEW SYSTEM PROMPT HERE`,
    // ...
}
```

### Primer 4: Dodavanje Nove Teme za Scary Stories

U `config/prompts.ts`:
```typescript
themes: [
    // ...
    'your new theme here',
    // ...
]
```

## 🐍 Python Image API

Za Python Image API (`server/image_api.py`), promptovi se mogu menjati preko environment variables:

```env
# U .env fajlu
STYLE_SIMPLE_CARTOON="your custom simple cartoon prompt"
STYLE_ANIME="your custom anime prompt"
DEFAULT_NEGATIVE_PROMPT="your custom negative prompt"
```

## 📝 Template Variables

Templates koriste `{variable}` sintaksu. Dostupne varijable:

- `{niche}` - Niche name (scary_stories, motivation, itd.)
- `{script}` - Story script text
- `{theme}` - Theme name
- `{previousStories}` - Previous stories text

## ✅ Provera Promena

Nakon promene promptova:
1. Restartuj TypeScript proces (`npm start`)
2. Za Python API, restartuj server (`python image_api.py`)

## 💡 Tips

- **Kratki promptovi** = brže generisanje, manje detalja
- **Dugacki promptovi** = sporije generisanje, više detalja
- **Specifični promptovi** = bolja konzistentnost
- **Opšti promptovi** = više varijacija

## 🔍 Gde se Koriste

- `SceneAnalysisPrompts` → `core/scene_analyzer.ts`
- `ImageStylePrompts` → `core/scene_analyzer.ts`, `server/image_api.py`
- `ScaryStoryPrompts` → `agents/content/scary.ts`
- `ContentPrompts` → `agents/content/index.ts` (za buduće niche-ove)









