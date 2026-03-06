import { rapidApiFetch } from '../client';
import { getYouTubeTranscript } from '../youtube-transcript/transcript';

const YOUTUBE_TRANSCRIPT_FAST_HOST =
  'youtube-transcribe-fastest-youtube-transcriber.p.rapidapi.com';

export interface TranscriptFastOptions {
  userId: string;
  videoUrl: string;
  lang?: string;
}

export interface TranscriptFastResult {
  transcript: string;
  videoId: string;
  lang: string;
  availableLangs: string[];
}

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
}

interface TranscriptFastApiResponse {
  status: string;
  data?: {
    text: string;
    lang: string;
    available_langs: string[];
    chunks: TranscriptChunk[];
  };
  error?: string;
  message?: string;
}

/**
 * Try the fast transcriber API first, fall back to the alternate endpoint.
 */
export async function getYouTubeTranscriptFast({
  userId,
  videoUrl,
  lang = 'en',
}: TranscriptFastOptions): Promise<TranscriptFastResult> {
  const videoId = extractVideoId(videoUrl);

  // Try primary (fast) endpoint
  try {
    const response = await rapidApiFetch<TranscriptFastApiResponse>(userId, {
      host: YOUTUBE_TRANSCRIPT_FAST_HOST,
      endpoint: '/transcript',
      params: {
        url: videoUrl,
        video_id: videoId,
        lang,
      },
      timeoutMs: 15000,
    });

    if (response.status === 'success' && response.data?.text) {
      return {
        transcript: response.data.text,
        videoId,
        lang: response.data.lang,
        availableLangs: response.data.available_langs,
      };
    }

    const errorMsg = response.error || response.message || '';
    console.warn(`Fast transcript API failed: ${errorMsg}. Trying fallback...`);
  } catch (error) {
    console.warn(
      `Fast transcript API error: ${error instanceof Error ? error.message : error}. Trying fallback...`
    );
  }

  // Fallback to alternate endpoint
  try {
    const fallbackResult = await getYouTubeTranscript({ userId, videoUrl, lang });
    return {
      transcript: fallbackResult.transcript,
      videoId: fallbackResult.videoId,
      lang: fallbackResult.lang,
      availableLangs: [],
    };
  } catch (fallbackError) {
    console.error(
      `Fallback transcript API also failed: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`
    );
    throw new Error(
      'Unable to extract transcript. Both transcript services are unavailable. Please try again later.'
    );
  }
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID itself
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return url; // Return as-is if no pattern matches
}
