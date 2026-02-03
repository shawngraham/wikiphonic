# Wikiphonic: Geospatial Sonifier

An experimental web application that transforms the semantic "latent space" of geographical landmarks into multi-voice orchestral compositions. By calculating the difference between two cultural or historical entities—as represented by the summary snippet from their associated Wikipedia articles—the app generates a unique auditory signature of their relationship.

## Architecture Overview

The application is built with a modern, on-device AI stack to ensure privacy, low latency, and offline-capable processing.

### 1. Semantic Intelligence (Transformers.js)
The core of the app is the **Sentence Transformer** model (`Xenova/all-MiniLM-L6-v2`).
- **On-Device Inference:** The NLP model is downloaded to the browser's cache and runs locally using ONNX Runtime.
- **Raw Vectorization:** Unlike typical similarity-search apps, we disable normalization. This allows the **Magnitude** of the vector to represent the "Semantic Density" or "Energy" of the text. A short, simple description produces a quiet, minimal piece; a dense, complex history produces a high-energy composition.
- **The "Journey" Vector:** By subtracting the Origin vector from the Target vector, we calculate a **Difference Vector**. This is the musical representation of the semantic distance between two places.

### 2. Audio Synthesis Engine (Tone.js)
The `MusicEngine` uses a curated selection of orchestral samples from the **Philharmonia Sound Sample Library**, chosen for their ability to handle rapid, data-driven triggering.
- **Bass:** *Bassoon* (A#1) — Provides a woody, foundational anchor.
- **Tenor:** *French Horn* (A3) — Fills the mid-range with warm, brassy textures.
- **Alto:** *Spiccato Violin* (A3) — Uses "bounced" bowing to handle 16th-note data streams with rhythmic clarity.
- **Soprano:** *Flute* (A4) — Provides agile, airy melodic top-lines.
- **Percussion:** A metrical section (Timpani/Toms, Woodblock, Triangle, Tam-tam) that anchors the data to a perceptible human pulse.

---

## The Sonification Logic

### 1. Metaphorical Partitioning
In Transformer models, information is distributed. We divide the 384 dimensions into four "Voices," giving each instrument a unique semantic window:
- **Bass (0-95):** Broad semantic clusters.
- **Tenor (96-191):** Cultural and functional features. Maybe. Who knows?
- **Alto (192-287):** Historical and relational data. Maybe. Who knows?
- **Soprano (288-383):** Specific stylistic and descriptive details. Maybe. Who knows?

### 2. Structural "Character" Mapping
The first few dimensions of the vector are used as "Global Variables" that set the musical rules for each specific landmark:
- **Time Signature ($v[0]$):** Determines if the piece "Waltzes" (3/4), remains steady (4/4), or feels tense and asymmetric (5/4).
- **Articulation ($v[1]$):** Determines if the performance is *Legato* (smooth and flowing) or *Staccato* (short and prickly).
- **Texture ($v[2]$):** Determines if the voices move together in chords (*Homophonic*) or chase each other independently (*Counterpoint*).

### 3. Rhythmic Adhesion
To ensure the data doesn't sound like "random noise," the engine employs **Metrical Anchoring**:
- The **Bassoon** and **Toms** are locked to the "Downbeat" (The 1).
- The **French Horn** and **Woodblock** provide a steady backbeat pulse.
- The **Violin** and **Flute** are the "Data Streamers," triggering notes only when semantic values cross a specific threshold.

---

## Exploration & Understanding

By using this app, you are exploring the **Latent Space of Human Knowledge**.

### What to Listen For:
- **Semantic Energy:** Notice how a long, detailed history of an ancient ruin results in a faster BPM and denser orchestration than a small local park.
- **The "Journey" (Difference Vector):** When you compare two landmarks, the music represents what makes them *different*. If you compare two similar cathedrals, the result will be quiet and minimalist. If you compare a skyscraper to a cemetery, the music will be harmonically and rhythmically complex.
- **Character Shifts:** Look for how the "feel" of the rhythm changes. A specific landmark might trigger a 5/4 time signature, creating an "unbalanced" feeling that is unique to its semantic embedding.

## Technical Requirements
- **Browser:** Modern Chrome, Firefox, or Edge.
- **Audio:** Headphones are highly recommended to hear the spatial and frequency separation of the orchestral voices.
- **Initial Load:** Requires a one-time download of the NLP model (~23MB) and the orchestral sample library.

## Run Locally

1. Install dependencies:
   `npm install`

2. Run the app:
   `npm run dev`

---
*Samples provided by the [Philharmonia Orchestra, London](https://philharmonia.co.uk/).*