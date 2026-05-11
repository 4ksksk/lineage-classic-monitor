const axios = require('axios');
const cheerio = require('cheerio');

const LIST_URL  = 'https://maplestory.nexon.com/News/Update';
const BASE_URL  = 'https://maplestory.nexon.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://maplestory.nexon.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractText($, el) {
  const $el = $(el);
  $el.find('img, script, style, iframe').remove();
  return $el.text().replace(/\s+/g, ' ').trim();
}

async function fetchArticle(url) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const $ = cheerio.load(data);

    // Nexon MapleStory 공식 사이트 공통 본문 선택자
    const selectors = [
      '.news_detail_content',
      '.article_content',
      '.view_content',
      '.board_view_content',
      '#articleContent',
      '.content_area',
      '.detail_content',
    ];

    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = extractText($, el);
        if (text.length > 30) return text.slice(0, 4000);
      }
    }

    // fallback: main 영역에서 가장 긴 p·div 텍스트
    let best = '';
    $('main p, main div, article p, article div').each((_, el) => {
      const t = $(el).clone().find('script,style').remove().end().text().trim();
      if (t.length > best.length) best = t;
    });
    return best.slice(0, 4000) || null;
  } catch {
    return null;
  }
}

async function crawlMapleOfficial() {
  const posts = [];
  try {
    const { data } = await axios.get(LIST_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);

    const candidates = [];
    const seen = new Set();

    // 업데이트 공지 링크 추출 (Nexon 사이트 공통 패턴)
    const linkSelectors = [
      'a[href*="/News/Update/"]',
      'a[href*="/news/update/"]',
      '.news_list a[href]',
      '.board_list a[href]',
      'ul.list_news li a',
      '.update_list a',
    ];

    for (const sel of linkSelectors) {
      $(sel).each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href || seen.has(href)) return;
        // 목록 페이지 자신은 제외
        const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        if (full === LIST_URL || full === `${LIST_URL}/`) return;
        const titleEl = $(el).find('strong, .tit, .title, h3, h4').first();
        const title = (titleEl.length ? titleEl.text() : $(el).text()).replace(/\s+/g, ' ').trim();
        if (!title || title.length < 2) return;
        seen.add(href);
        candidates.push({ title, url: full });
      });
      if (candidates.length >= 5) break;
    }

    for (const item of candidates.slice(0, 5)) {
      const content = await fetchArticle(item.url);
      posts.push({ title: item.title, date: '', content: content || '', link: item.url, isRecent: false });
      await sleep(500);
    }

    console.log(`[메이플스토리 공식] ${posts.length}개 수집`);
  } catch (err) {
    console.error('[메이플스토리 공식 크롤링 오류]', err.message);
  }
  return posts;
}

module.exports = { crawlMapleOfficial };
