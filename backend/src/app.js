const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { requireAuth } = require('./middleware/auth');
const donationsRouter = require('./routes/donations');
const requestsRouter = require('./routes/requests');
const allocationRunsRouter = require('./routes/allocationRuns');
const exactBundleRouter = require('./routes/exactBundle');
const routesRouter = require('./routes/routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/donations', requireAuth, donationsRouter);
app.use('/api/requests', requireAuth, requestsRouter);
app.use('/api/allocation-runs', requireAuth, allocationRunsRouter);
app.use('/api', requireAuth, exactBundleRouter);
app.use('/api/requests', requireAuth, exactBundleRouter);
app.use('/api', requireAuth, routesRouter);
app.use('/api/routes', requireAuth, routesRouter);
app.use('/api/route-stops', requireAuth, routesRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
