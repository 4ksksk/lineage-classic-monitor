const axios = require('axios');
const cheerio = require('cheerio');

const API_BASE = 'https://api-community.plaync.com/aion2/board/update_ko';
const VIEW_BASE = 'https://aion2.plaync.com/ko-kr/board/update/view';
const HTML_URL = 'https://aion2.plaync.com/ko-kr/board/update';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://aion2.plaync.com/',
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

async function crawlViaHTML() {
  const posts = [];
  try {
    const { data } = await axios.get(HTML_URL, {
      headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml' },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    const seen = new Set();

    $('a[href*="board/update/view"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      if (!title || seen.has(href)) return;
      seen.add(href);
      const url = href.startsWith('http') ? href : `https://aion2.plaync.com${href}`;
      posts.push({ title, date: '', content: '', link: url, isRecent: false });
    });

    console.log(`[아이온2 공식] HTML 파싱 ${posts.length}개 수집`);
  } catch (err) {
    console.error('[아이온2 공식 HTML 파싱 오류]', err.message);
  }
  return posts.slice(0, 3);
}

async function crawlAion2Official() {
  const posts = [];
  try {
    const { data } = await axios.get(`${API_BASE}/article`, {
      params: { sort: 'TimeDesc', page: 0, pageSize: 5 },
      headers: HEADERS,
      timeout: 15000,
    });

    const articles = data.contentList || [];
    if (!articles.length) throw new Error('빈 응답');

    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    const recent = articles.filter(a => {
      const ts = a.timestamps?.postedEpoch ? a.timestamps.postedEpoch * 1000 : new Date(a.timestamps?.postedAt || 0).getTime();
      return ts > sixHoursAgo;
    });

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

    console.log(`[아이온2 공식] API ${posts.length}개 수집`);
    return posts;
  } catch (err) {
    console.error('[아이온2 공식 API 오류]', err.message, '→ HTML 파싱으로 전환');
    return crawlViaHTML();
  }
}

module.exports = { crawlAion2Official };
