const axios = require('axios');
const cheerio = require('cheerio');

const GALLERY_URL  = 'https://gall.dcinside.com/mgallery/board/lists/?id=aion2';
const GALLERY_BASE = 'https://gall.dcinside.com';

const SKIP_RE  = /이용\s*안내|^\[공지\]|\[이벤트\]|이벤트\s*참여|\[안내\]|공지글|^공지/i;
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
      headers: { ...HEADERS, Referer: GALLERY_URL },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const text = $('.write_div').text().replace(/\s+/g, ' ').trim();
    return text.slice(0, 800) || null;
  } catch {
    return null;
  }
}

async function crawlAion2DCInside() {
  const posts = [];
  try {
    const { data } = await axios.get(GALLERY_URL, {
      headers: { ...HEADERS, Referer: 'https://gall.dcinside.com/' },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const candidates = [];

    $('tr').each((_, el) => {
      const $td = $(el).find('td.gall_tit.ub-word');
      if (!$td.length) return;

      const $a = $td.find('a[href]').first();
      const href = $a.attr('href') || '';
      if (!href || $a.find('.icon_ad').length) return;

      const title = $a.clone().find('em').remove().end().text().replace(/\s+/g, ' ').trim();
      if (!title || SKIP_RE.test(title)) return;

      const url = href.startsWith('http') ? href : `${GALLERY_BASE}${href}`;
      candidates.push({ title, url });
    });

    for (const item of candidates.slice(0, MAX_POSTS)) {
      const content = await fetchContent(item.url);
      if (content) posts.push({ title: item.title, content });
      await sleep(DELAY_MS);
    }

    console.log(`[아이온2 DC인사이드] ${posts.length}개 수집 (본문 포함)`);
  } catch (err) {
    console.error('[아이온2 DC인사이드 크롤링 오류]', err.message);
  }
  return posts;
}

module.exports = { crawlAion2DCInside };
