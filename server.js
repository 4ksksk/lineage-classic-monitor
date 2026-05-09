require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { runCrawlAndAnalyze, startScheduler } = require('./scheduler/index');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data', 'results.json');

const EMPTY = { lastUpdated: null, officialPosts: [], dcPosts: [], invenPosts: [], analysis: null };

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/results', (req, res) => {
  if (!fs.existsSync(DATA_PATH)) return res.json(EMPTY);
  try {
    res.json(JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')));
  } catch {
    res.status(500).json({ error: '데이터 파일을 읽을 수 없습니다.' });
  }
});

app.post('/api/crawl', async (req, res) => {
  try {
    const result = await runCrawlAndAnalyze();
    const total = result.officialPosts.length + result.dcPosts.length + result.invenPosts.length;
    res.json({ success: true, message: '크롤링 완료', count: total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`리니지클래식 모니터 서버 실행 중: http://localhost:${PORT}`);
  startScheduler();
});
