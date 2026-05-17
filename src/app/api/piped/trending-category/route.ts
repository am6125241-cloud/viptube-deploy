import { NextRequest, NextResponse } from 'next/server';
import { searchMultipleQueries } from '@/lib/youtube-api';

const trendingCategoryQueries: Record<string, string[]> = {
  'Music': [
    'Bollywood new songs 2025',
    'Arijit Singh latest song',
    'Punjabi music video new',
    'Tamil romantic song 2025',
  ],
  'Gaming': [
    'BGMI gameplay highlights India',
    'GTA 5 India funny moments',
    'Minecraft Hindi gameplay',
    'Free Fire tournament India',
  ],
  'News': [
    'Aaj Tak breaking news today',
    'India news Hindi headlines',
    'WION latest news India',
    'ABP News live updates',
  ],
  'Films': [
    'Bollywood movie trailer 2025',
    'South Indian Hindi dubbed movie',
    'Pushpa 3 teaser latest',
    'Hindi movie review new release',
  ],
  'Sports': [
    'IPL cricket highlights 2025',
    'Virat Kohli best innings',
    'Olympics India highlights',
    'Kabaddi Pro League match',
  ],
  'Comedy': [
    'Indian comedy video viral',
    'Hindi funny video family',
    'BB Ki Vines latest',
    'CarryMinati new video',
  ],
  'Devotional': [
    'Hanuman Chalisa new version',
    'Hindi bhajan trending 2025',
    'aarti new release Hindi',
    'Sunday bhajan collection',
  ],
  'Tech': [
    'Indian tech review latest',
    'best phone under 15000 India',
    'gadgets review Hindi 2025',
    'Trakin Tech latest video',
  ],
};

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');
    if (!category || category === 'Now') {
      return NextResponse.json({ videos: [], hasMore: false });
    }

    const queries = trendingCategoryQueries[category];
    if (!queries) {
      return NextResponse.json({ videos: [], hasMore: false });
    }

    const result = await searchMultipleQueries(queries, 30);
    return NextResponse.json({
      videos: result.videos,
      hasMore: result.videos.length >= 10,
    });
  } catch (error) {
    console.error('Trending category API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending category videos', videos: [], hasMore: false },
      { status: 502 }
    );
  }
}
