import { NextResponse } from "next/server";
import { getAccessToken, generateSpeech } from "@/lib/vertex";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

// Robust FFmpeg path resolution
const getFfmpegPath = () => {
    // 1. Try known global path (common on Windows dev setups)
    const globalPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
    if (fs.existsSync(globalPath)) {
        console.log(`Found global FFmpeg at: ${globalPath}`);
        return globalPath;
    }

    // 2. Try local project path (if bundled)
    const localPath = path.join(process.cwd(), 'ffmpeg', 'bin', 'ffmpeg.exe');
    if (fs.existsSync(localPath)) {
        console.log(`Found local project FFmpeg at: ${localPath}`);
        return localPath;
    }

    // 3. Try ffmpeg-static (if valid)
    if (ffmpegStatic) {
        // Check if the static path actually exists to avoid ENOENT
        // Note: ffmpeg-static might return a path that needs to be extracted, but usually it points to the binary.
        // On some serverless envs it might be different, but here we are local.
        try {
            if (fs.existsSync(ffmpegStatic)) {
                console.log(`Found ffmpeg-static at: ${ffmpegStatic}`);
                return ffmpegStatic;
            }
        } catch (e) {
            console.warn("Error checking ffmpeg-static path:", e);
        }
    }

    // 4. Fallback to system PATH
    console.log("Falling back to system 'ffmpeg' command");
    return "ffmpeg";
}

const getFfprobePath = () => {
    const globalPath = 'C:\\ffmpeg\\bin\\ffprobe.exe';
    if (fs.existsSync(globalPath)) return globalPath;

    const localPath = path.join(process.cwd(), 'ffmpeg', 'bin', 'ffprobe.exe');
    if (fs.existsSync(localPath)) return localPath;

    return "ffprobe";
}

const resolvedFfmpegPath = getFfmpegPath();
const resolvedFfprobePath = getFfprobePath();

ffmpeg.setFfmpegPath(resolvedFfmpegPath);
ffmpeg.setFfprobePath(resolvedFfprobePath);

console.log(`Final FFmpeg configuration: ${resolvedFfmpegPath}`);

export async function POST(req: Request) {
    try {
        const { text, voiceName, modelName, prompt, speed, pitch, volume } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        const accessToken = await getAccessToken();

        // Strip emojis for TTS generation so they aren't read aloud
        // Regex matches standard emojis and symbols often used as emojis
        const textForSpeech = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2190}-\u{21FF}]/gu, '');

        // Always send pitch: 0 to API to avoid "not supported" errors
        // We will handle pitch shifting manually with FFmpeg if needed
        const audioContent = await generateSpeech({
            text: textForSpeech,
            accessToken: accessToken || "",
            voiceName,
            modelName,
            prompt,
            speed, // Speed is handled by API (speakingRate)
            pitch: 0,
            volume
        });

        // If no pitch shift requested, return immediately
        if (!pitch || pitch === 0) {
            return NextResponse.json({ audioContent });
        }

        console.log(`Applying pitch shift: ${pitch} semitones`);

        // --- Pitch Shifting Logic ---
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
        const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);

        console.log(`Temp paths: ${inputPath} -> ${outputPath}`);

        // Write base64 to temp file
        await writeFile(inputPath, Buffer.from(audioContent, 'base64'));
        console.log("Input file written");

        // Calculate new sample rate for pitch shift
        // Formula: new_rate = old_rate * 2^(semitones/12)
        // We need to probe the file first to get the sample rate
        const sampleRate = await new Promise<number>((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, metadata) => {
                if (err) {
                    console.error("ffprobe error:", err);
                    reject(err);
                }
                else resolve(metadata.streams[0].sample_rate || 24000);
            });
        });

        console.log(`Original sample rate: ${sampleRate}`);

        const pitchFactor = Math.pow(2, pitch / 12);
        const newSampleRate = Math.round(sampleRate * pitchFactor);

        // asetrate changes both pitch and speed (higher pitch = faster)
        // We need to compensate for the speed change to keep original duration
        // Target speed factor = 1.0
        // Current speed factor = pitchFactor
        // Correction needed = 1 / pitchFactor
        let speedCorrection = 1 / pitchFactor;

        const filters = [`asetrate=${newSampleRate}`, `aresample=${sampleRate}`];

        // atempo filter is limited to 0.5 to 2.0 range
        // We might need to chain multiple atempo filters for extreme pitch shifts
        while (speedCorrection < 0.5) {
            filters.push('atempo=0.5');
            speedCorrection /= 0.5;
        }
        while (speedCorrection > 2.0) {
            filters.push('atempo=2.0');
            speedCorrection /= 2.0;
        }
        // Apply remaining correction if it's not effectively 1.0
        if (Math.abs(speedCorrection - 1.0) > 0.01) {
            filters.push(`atempo=${speedCorrection}`);
        }

        console.log(`FFmpeg filters: ${filters.join(', ')}`);

        // Apply pitch shift using asetrate (changes speed and pitch) and aresample (restores sample rate)
        // This matches the behavior of Web Audio API's detune
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioFilters(filters)
                .toFormat('mp3')
                .on('start', (commandLine) => {
                    console.log('Spawned Ffmpeg with command: ' + commandLine);
                })
                .on('end', resolve)
                .on('error', (err) => {
                    console.error("ffmpeg processing error:", err);
                    reject(err);
                })
                .save(outputPath);
        });

        console.log("FFmpeg processing complete");

        // Read processed file
        const processedBuffer = await readFile(outputPath);
        const processedBase64 = processedBuffer.toString('base64');

        // Cleanup
        await Promise.all([
            unlink(inputPath).catch(() => { }),
            unlink(outputPath).catch(() => { })
        ]);

        return NextResponse.json({ audioContent: processedBase64 });

    } catch (error: any) {
        console.error("TTS Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate speech" }, { status: 500 });
    }
}
