import { NextRequest, NextResponse } from 'next/server';

// Fetch more comments using YouTube's next API with continuation token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { continuationToken, visitorData } = body;

    if (!continuationToken) {
      return NextResponse.json(
        { error: 'Missing continuation token', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const YOUTUBE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    const context: any = {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20250610.00.00',
        hl: 'en',
        gl: 'IN',
        platform: 'DESKTOP',
      },
      request: { useSsl: true },
    };

    if (visitorData) {
      context.client.visitorData = visitorData;
    }

    const response = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': YOUTUBE_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
      },
      body: JSON.stringify({ context, continuation: continuationToken }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch comments', code: 'FETCH_ERROR' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Parse comments from response
    const endpoints = data?.onResponseReceivedEndpoints || [];
    const comments: any[] = [];
    let nextContinuationToken: string | undefined;

    for (const ep of endpoints) {
      const cmd = ep?.reloadContinuationItemsCommand || ep?.appendContinuationItemsAction;
      if (!cmd) continue;

      const items = cmd?.continuationItems || [];
      for (const item of items) {
        if (item?.commentThreadRenderer) {
          const thread = item.commentThreadRenderer;
          const renderer = thread?.comment?.commentRenderer;
          if (renderer?.commentId) {
            comments.push({
              commentId: renderer.commentId,
              authorName: renderer.authorText?.simpleText || renderer.authorText?.runs?.map((r: any) => r.text).join('') || '',
              authorAvatar: renderer.authorThumbnail?.thumbnails?.[0]?.url || '',
              authorChannelId: renderer.authorEndpoint?.browseEndpoint?.browseId || '',
              text: renderer.contentText?.simpleText || renderer.contentText?.runs?.map((r: any) => r.text).join('') || '',
              likeCount: renderer.voteCount?.simpleText || '',
              publishedTime: renderer.publishedTimeText?.simpleText || '',
              isCreator: false,
              isVerified: renderer.authorCommentBadge?.authorCommentBadgeRenderer?.iconTooltip === 'Verified' ||
                         renderer.ownerBadges?.some?.((b: any) => b.metadataBadgeRenderer?.tooltip === 'Verified') || false,
              replyCount: 0,
            });
          }
        }

        if (item?.continuationItemRenderer) {
          nextContinuationToken =
            item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
            item.continuationItemRenderer?.continuationEndpoint?.token || '';
        }
      }
    }

    // Also try frameworkUpdates format
    if (comments.length === 0) {
      const mutations = data?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
      const commentEntities = new Map<string, any>();
      for (const mut of mutations) {
        const cp = mut?.payload?.commentEntityPayload;
        if (cp?.properties?.commentId) {
          commentEntities.set(cp.properties.commentId, cp);
        }
      }

      for (const ep of endpoints) {
        const cmd = ep?.reloadContinuationItemsCommand || ep?.appendContinuationItemsAction;
        if (!cmd) continue;
        const items = cmd?.continuationItems || [];
        for (const item of items) {
          if (item?.commentThreadRenderer) {
            const thread = item.commentThreadRenderer;
            const viewModel = thread?.commentViewModel?.commentViewModel;
            const commentId = viewModel?.commentId;
            const entity = commentId ? commentEntities.get(commentId) : null;
            if (!entity?.author || !entity?.properties) continue;

            comments.push({
              commentId: commentId || entity.properties.commentId || '',
              authorName: entity.author.displayName || '',
              authorAvatar: entity.author.avatarThumbnailUrl || '',
              authorChannelId: entity.author.channelId || '',
              text: entity.properties.content?.content || '',
              likeCount: entity.toolbar?.likeCountA11y || '',
              publishedTime: entity.properties.publishedTime || '',
              isCreator: entity.author.isCreator || false,
              isVerified: entity.author.isVerified || false,
              replyCount: 0,
            });
          }
          if (item?.continuationItemRenderer) {
            nextContinuationToken =
              item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
              item.continuationItemRenderer?.continuationEndpoint?.token || '';
          }
        }
      }
    }

    return NextResponse.json({
      comments,
      nextContinuationToken,
    });
  } catch (error) {
    console.error('Comments next page API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch more comments', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
