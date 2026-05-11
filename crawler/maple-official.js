const axios = require('axios');
const cheerio = require('cheerio');

const LIST_URL  = 'https://maplestory.nexon.com/News/Update';
const BASE_URL  = 'https://maplestory.nexon.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://maplestory.nexon.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

const DATE_SELECTORS = [
  'time[datetime]',
  '.view_date',
  '.article_date',
  '.post_date',
  '.info_date',
  '.date',
  '.news_date',
  '.board_date',
  '.list_date',
  '.txt_date',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractText($, el) {
  const $el = $(el);
  $el.find('img, script, style, iframe').remove();
  return $el.text().replace(/\s+/g, ' ').trim();
}

function pickDate($, scope) {
  for (const sel of DATE_SELECTORS) {
    const el = (scope ? $(scope).find(sel) : $(sel)).first();
    if (!el.length) continue;
    const raw = (el.attr('datetime') || el.text()).replace(/\s+/g, ' ').trim();
    if (raw) return raw;
  }
  return '';
}

async function fetchArticle(url) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const $ = cheerio.load(data);

    // 본문 텍스트에서 "YYYY년 M월 D일" 패턴으로 날짜 추출
    const bodyText = $('body').text();
    const dateMatch = bodyText.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    const date = dateMatch
      ? `${dateMatch[1]}년 ${dateMatch[2]}월 ${dateMatch[3]}일`
      : '';

    console.log(`[메이플 공식] URL: ${url} / 날짜: ${date || '(추출 실패)'}`);

    const contentSelectors = [
      '.news_detail_content',
      '.article_content',
      '.view_content',
      '.board_view_content',
      '#articleContent',
      '.content_area',
      '.detail_content',
    ];

    for (const sel of contentSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = extractText($, el);
        if (text.length > 30) return { content: text.slice(0, 4000), date };
      }
    }

    let best = '';
    $('main p, main div, article p, article div').each((_, el) => {
      const t = $(el).clone().find('script,style').remove().end().text().trim();
      if (t.length > best.length) best = t;
    });
    return { content: best.slice(0, 4000) || null, date };
  } catch {
    return { content: null, date: '' };
  }
}

async function crawlMapleOfficial() {
  const posts = [];
  try {
    const { data } = await axios.get(LIST_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);

    const candidates = [];
    const seen = new Set();

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
        const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        if (full === LIST_URL || full === `${LIST_URL}/`) return;

        const titleEl = $(el).find('strong, .tit, .title, h3, h4').first();
        const title = (titleEl.length ? titleEl.text() : $(el).text()).replace(/\s+/g, ' ').trim();
        if (!title || title.length < 2) return;

        // 목록에서 날짜 추출 시도 (부모 li/tr에서 탐색)
        const parent = $(el).closest('li, tr, .list_item, .board_item, .news_item');
        const listDate = pickDate($, parent.length ? parent : el);

        seen.add(href);
        candidates.push({ title, url: full, listDate });
      });
      if (candidates.length >= 5) break;
    }

    for (const item of candidates.slice(0, 5)) {
      const { content, date } = await fetchArticle(item.url);
      posts.push({
        title: item.title,
        date: item.listDate || date,
        content: content || '',
        link: item.url,
        isRecent: false,
      });
      await sleep(500);
    }

    console.log(`[메이플스토리 공식] ${posts.length}개 수집`);
  } catch (err) {
    console.error('[메이플스토리 공식 크롤링 오류]', err.message);
  }
  return posts;
}

module.exports = { crawlMapleOfficial };
