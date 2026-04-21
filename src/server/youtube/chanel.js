const { google } = require("googleapis");

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY
});

async function ChannelVideos({ channelId = null, search = null, max = 5 }) {
  let authorName = "None";
  let subscribers = 0;  

  //ดึงชื่อyoutuberและยอดซับ
  if(channelId){
    const channelRes = await youtube.channels.list({
      part: "snippet,statistics",
      id: channelId
    });

    const channel = channelRes.data.items[0];
    authorName = channel?.snippet?.title ?? "None";
    subscribers = channel?.statistics?.subscriberCount || 0;
  }

  //ดึงวิดีโอจาก Search API
  const searchParams = {
    part: "snippet",
    maxResults: max,
    type: "video",
    videoDuration: "short",
    order: "relevance",
    regionCode: "TH",
    relevanceLanguage: "th",
  };

  if (channelId) {
    searchParams.channelId = channelId;
    searchParams.order = "date"; // ถ้าเป็นช่องให้เอาอันล่าสุด
  } else if (search) {
    searchParams.q = `${search}`;
  }
  const searchRes = await youtube.search.list(searchParams);
  const items = searchRes.data.items;
  const videoIds = items.map((v) => v.id.videoId);
  const channelIds = [...new Set(items.map((v) => v.snippet.channelId))]; // ใช้ Set เพื่อไม่ให้ดึง id ช่องซ้ำกัน
  if (!items || items.length === 0) {
    return [];
  }

  // --- ส่วนที่ 2: ดึงข้อมูลยอดซับของทุกช่องที่เจอ ---
  const channelsRes = await youtube.channels.list({
    part: "statistics,snippet",
    id: channelIds.join(","),
  });

  const subMap = {};
  const avatarMap = {};
  const viewMap = {};

  channelsRes.data.items.forEach((ch) => {
    subMap[ch.id] = ch.statistics.subscriberCount;
    viewMap[ch.id] = ch.statistics.viewCount;
    avatarMap[ch.id] = ch.snippet?.thumbnails?.high?.url || 
                       ch.snippet?.thumbnails?.medium?.url || 
                       ch.snippet?.thumbnails?.default?.url || '';
  });

  //ดึงstaticVDO
  const videoRes = await youtube.videos.list({ 
  part: "snippet,statistics",
  id: videoIds.join(",")
  });  //ให้idเชื่อมvideoIdsเป็น1อันคั่นด้วยcomma

  const thaiRegex = /[\u0E00-\u0E7F]/;
  const thaiItems = videoRes.data.items.filter(v => {
    const lang = v.snippet?.defaultAudioLanguage || 
                 v.snippet?.defaultLanguage || '';
    const title = v.snippet?.title || '';
    const desc = v.snippet?.description || '';
    const channelTitle = v.snippet?.channelTitle || '';

    if (lang.startsWith('th')) return true;

    return thaiRegex.test(title) || 
           thaiRegex.test(desc) || 
           thaiRegex.test(channelTitle);
  });

  //ดึงcomments
  const finalItems = thaiItems.length > 0 ? thaiItems : videoRes.data.items;
  return Promise.all(finalItems.slice(0, max).map(async(v) => {
    let topComments = [];
    try {
      const commentRes = await youtube.commentThreads.list({
        part: "snippet",
        videoId: v.id,
        maxResults: 3, // ดึงแค่ 3 คอมเมนต์
        order: "relevance" // เอาคอมเมนต์ที่เกี่ยวข้องหรือเด่นที่สุด
      });

      topComments = commentRes.data.items.map(c => ({
        commentId: c.id,
        text: c.snippet.topLevelComment.snippet.textDisplay
      }));
    } catch (error) {
      console.error(`Could not fetch comments for video ${v.id}:`, error.message);
      // บางวิดีโออาจจะปิดคอมเมนต์ไว้ ต้องใส่ try-catch กันพัง
    }
      return {
        channelId: v.snippet.channelId,
        authorName: v.snippet.channelTitle,
        subscribers: Number(subMap[v.snippet.channelId]) || 0,
        channelViews: Number(viewMap[v.snippet.channelId]) || 0,
        authorAvatar: avatarMap[v.snippet.channelId] || '',
        platform: "youtube",
        videoId: v.id ?? "None",
        title: v.snippet?.title ?? "None",
        caption: v.snippet?.description ?? "None",
        url: `https://www.youtube.com/watch?v=${v.id}`,
        totalViews: v.statistics.viewCount || 0,
        totalLikes: v.statistics.likeCount || 0,
        totalComments: v.statistics.commentCount || 0,
        comments: topComments // เพิ่ม Array ของคอมเมนต์เข้าไปตรงนี้
      };
    }));
}

module.exports = ChannelVideos;
