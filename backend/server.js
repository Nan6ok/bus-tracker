const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 代理Wheels Router API请求
app.post('/api/route-plan', async (req, res) => {
    try {
        const { from, to } = req.body;
        const response = await axios.get('https://engine.justusewheels.com/route', {
            params: {
                from: from,
                to: to,
                mode: 'TRANSIT'
            },
            headers: {
                'User-Agent': 'HK-Bus-Tracker/1.0',
                'Accept-Encoding': 'gzip'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Route planning error:', error.message);
        res.status(500).json({ error: '路線規劃失敗' });
    }
});

// 获取巴士站点列表
app.get('/api/bus-stops/:company/:route', async (req, res) => {
    const { company, route } = req.params;
    const direction = req.query.dir || 'outbound';
    
    try {
        let apiUrl;
        if (company === 'CTB') {
            apiUrl = 'https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta/resource/11713602-ea6c-49ad-9c59-7b45721c43ed';
        } else if (company === 'KMB') {
            apiUrl = 'https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb/resource/...';
        }
        
        const response = await axios.get(apiUrl);
        res.json(response.data);
    } catch (error) {
        console.error('Bus stops error:', error.message);
        res.status(500).json({ error: '無法獲取巴士站點' });
    }
});

// 获取实时ETA
app.get('/api/eta/:company/:route/:stopId', async (req, res) => {
    const { company, route, stopId } = req.params;
    
    try {
        let apiUrl;
        if (company === 'CTB') {
            apiUrl = `https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta/resource/e1961565-f6ba-4831-958e-1b2dab7b8703`;
        } else if (company === 'KMB') {
            apiUrl = `https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb/resource/...`;
        }
        
        const response = await axios.get(apiUrl, {
            params: { route, stopId }
        });
        res.json(response.data);
    } catch (error) {
        console.error('ETA error:', error.message);
        res.status(500).json({ error: '無法獲取到站時間' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
