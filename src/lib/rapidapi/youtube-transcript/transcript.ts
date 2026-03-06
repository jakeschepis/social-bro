import { rapidApiFetch } from '../client';

const YOUTUBE_TRANSCRIPTS_HOST = 'youtube-transcripts.p.rapidapi.com';

export interface TranscriptOptions {
  userId: string;
  videoUrl: string;
  lang?: string;
}

export interface TranscriptResult {
  transcript: string;
  videoId: string;
  lang: string;
}

interface TranscriptsApiResponse {
  lang?: string;
  availableLangs?: string[];
  content?: string;
  error?: string;
  message?: string;
}

/**
 * Extract transcript using the YouTube Transcripts API (fallback endpoint)
 */
export async function getYouTubeTranscript({
  userId,
  videoUrl,
  lang = 'en',
}: TranscriptOptions): Promise<TranscriptResult> {
  const videoId = extractVideoId(videoUrl);

  const response = await rapidApiFetch<TranscriptsApiResponse>(userId, {
    host: YOUTUBE_TRANSCRIPTS_HOST,
    endpoint: '/youtube/transcript',
    params: {
      url: videoUrl,
      videoId,
      chunkSize: '500',
      text: 'true',
      lang,
    },
    timeoutMs: 15000,
  });

  if (response.error || response.message) {
    throw new Error(response.error || response.message || 'Failed to extract transcript');
  }

  if (!response.content || typeof response.content !== 'string') {
    throw new Error('No transcript available for this video');
  }

  return {
    transcript: response.content,
    videoId,
    lang: response.lang || lang,
  };
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
