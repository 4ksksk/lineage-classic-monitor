const axios = require('axios');
const cheerio = require('cheerio');

const API_BASE = 'https://api-community.plaync.com/linclassic/board/update_ko';
const CATEGORY_ID = '6985e12a7b5b7b71a09d93eb';
const VIEW_BASE = 'https://lineageclassic.plaync.com/ko-kr/board/update/view';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://lineageclassic.plaync.com/',
  'Accept': 'application/json',
};

function parseDate(raw) {
  if (!raw) return '';
  return new Date(raw).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function htmlToText(html) {
  if (!html) return '';
  const $ = cheerio.load(html);
  $('img, script, style').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

async function fetchContent(mongoId) {
  try {
    const { data } = await axios.get(`${API_BASE}/article/${mongoId}`, {
      headers: HEADERS,
      timeout: 10000,
    });
    const html = data?.article?.content?.content || '';
    return htmlToText(html).slice(0, 4000);
  } catch {
    return '';
  }
}

async function crawlOfficial() {
  const posts = [];
  try {
    const { data } = await axios.get(`${API_BASE}/article`, {
      params: { categoryId: CATEGORY_ID, sort: 'TimeDesc', page: 0, pageSize: 5 },
      headers: HEADERS,
      timeout: 15000,
    });

    const articles = data.contentList || [];
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

    const recent = articles.filter(a => {
      const ts = a.timestamps?.postedEpoch ? a.timestamps.postedEpoch * 1000 : new Date(a.timestamps?.postedAt || 0).getTime();
      return ts > sixHoursAgo;
    });

    // 최근 업데이트가 없으면 가장 최신 1개만
    const targets = recent.length > 0 ? recent : articles.slice(0, 1);

    for (const article of targets) {
      const content = await fetchContent(article.id);
      posts.push({
        title: article.title || '',
        date: parseDate(article.timestamps?.postedAt),
        content: content || article.summary || '',
        link: `${VIEW_BASE}?articleId=${article.snow?.contentId}`,
        isRecent: recent.includes(article),
      });
    }

    console.log(`[공식사이트] ${posts.length}개 수집`);
  } catch (err) {
    console.error('[공식사이트 크롤링 오류]', err.message);
  }
  return posts;
}

module.exports = { crawlOfficial };
