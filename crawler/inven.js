const axios = require('axios');
const cheerio = require('cheerio');

const BOARD_URL = 'https://www.inven.co.kr/board/lineageclassic/6482';

const SKIP_RE  = /이용\s*안내|^\[공지\]|^\[안내\]|^\[이벤트\]|이벤트\s*참여|^이벤트\d|업데이트\s*안내|방송인.{0,10}정보/i;
const MAX_POSTS = 20;
const DELAY_MS  = 400;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchContent(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { ...HEADERS, Referer: BOARD_URL },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const text = (
      $('.articleContent').text() ||
      $('.write-content').text()  ||
      $('#textviewer').text()
    ).replace(/\s+/g, ' ').trim();
    return text.slice(0, 800) || null;
  } catch {
    return null;
  }
}

async function crawlInven() {
  const posts = [];
  try {
    const { data } = await axios.get(BOARD_URL, {
      headers: { ...HEADERS, Referer: 'https://www.inven.co.kr/' },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const candidates = [];

    $('tr').each((_, el) => {
      const $a = $(el).find('a.subject-link').first();
      const href = $a.attr('href') || '';
      if (!href) return;

      const title = $a.clone().find('span.category').remove().end().text().trim();
      if (!title || SKIP_RE.test(title)) return;

      const url = href.startsWith('http') ? href : `https://www.inven.co.kr${href}`;
      candidates.push({ title, url });
    });

    for (const item of candidates.slice(0, MAX_POSTS)) {
      const content = await fetchContent(item.url);
      if (content) posts.push({ title: item.title, content });
      await sleep(DELAY_MS);
    }

    console.log(`[인벤] ${posts.length}개 수집 (본문 포함)`);
  } catch (err) {
    console.error('[인벤 크롤링 오류]', err.message);
  }
  return posts;
}

module.exports = { crawlInven };
