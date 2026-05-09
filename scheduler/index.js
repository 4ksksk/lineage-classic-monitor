const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { crawlOfficial } = require('../crawler/official');
const { crawlDCInside } = require('../crawler/dcinside');
const { crawlInven } = require('../crawler/inven');
const { analyzePosts } = require('../gemini/analyzer');

const DATA_PATH = path.join(__dirname, '../data/results.json');

async function runCrawlAndAnalyze() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 크롤링 시작`);

  const [officialResult, dcResult, invenResult] = await Promise.allSettled([
    crawlOfficial(),
    crawlDCInside(),
    crawlInven(),
  ]);

  const officialPosts = officialResult.status === 'fulfilled' ? officialResult.value : [];
  const dcPosts       = dcResult.status === 'fulfilled'       ? dcResult.value       : [];
  const invenPosts    = invenResult.status === 'fulfilled'    ? invenResult.value    : [];

  const total = officialPosts.length + dcPosts.length + invenPosts.length;
  console.log(`[스케줄러] 수집 완료 — 공식 ${officialPosts.length} / DC ${dcPosts.length} / 인벤 ${invenPosts.length} (합계 ${total})`);

  let analysis = null;
  const hasKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

  if (total > 0 && hasKey) {
    try {
      console.log('[스케줄러] Gemini 분석 시작 (API 1회 호출)...');
      analysis = await analyzePosts(officialPosts, dcPosts, invenPosts);
      console.log('[스케줄러] Gemini 분석 완료');
    } catch (err) {
      console.error('[Gemini 분석 오류]', err.message);
    }
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    officialPosts,
    dcPosts,
    invenPosts,
    analysis,
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log('[스케줄러] 저장 완료 →', DATA_PATH);
  return result;
}

function startScheduler() {
  cron.schedule('0 13 * * *', runCrawlAndAnalyze, { timezone: 'Asia/Seoul' });
  cron.schedule('0 16 * * *', runCrawlAndAnalyze, { timezone: 'Asia/Seoul' });
  console.log('[스케줄러] 등록 완료 (13:00 / 16:00 KST)');
}

module.exports = { runCrawlAndAnalyze, startScheduler };
