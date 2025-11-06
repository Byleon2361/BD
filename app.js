// app-fixed.js
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
app.use(express.json());

// ПРАВИЛЬНЫЕ НАСТРОЙКИ ПОДКЛЮЧЕНИЯ
const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';
let db;

// Подключение к MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('news_aggregator');
        console.log('✅ Connected to MongoDB successfully');
        
        // Проверяем подключение
        const collections = await db.listCollections().toArray();
        console.log(`📁 Available collections: ${collections.map(c => c.name).join(', ')}`);
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

// ENDPOINT 1: Получить топ новостей по просмотрам
app.get('/api/news/top', async (req, res) => {
    try {
        const { category, limit = 10 } = req.query;
        
        let matchStage = { "metadata.isActive": true };
        if (category) matchStage.category = category;
        
        const pipeline = [
            { $match: matchStage },
            { $sort: { "metrics.views": -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    title: 1,
                    category: 1,
                    "metrics.views": 1,
                    "metrics.likes": 1,
                    "metadata.publishDate": 1,
                    "source.name": 1,
                    "author.firstName": 1,
                    "author.lastName": 1
                }
            }
        ];
        
        const results = await db.collection('news').aggregate(pipeline).toArray();
        res.json({
            success: true,
            data: results,
            total: results.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ENDPOINT 2: Статистика по категориям
app.get('/api/stats/categories', async (req, res) => {
    try {
        const pipeline = [
            {
                $match: {
                    "metadata.isActive": true,
                    "metadata.publishDate": { 
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
                    }
                }
            },
            {
                $group: {
                    _id: "$category",
                    totalArticles: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    totalLikes: { $sum: "$metrics.likes" },
                    avgViews: { $avg: "$metrics.views" }
                }
            },
            {
                $project: {
                    category: "$_id",
                    totalArticles: 1,
                    totalViews: 1,
                    totalLikes: 1,
                    avgViews: { $round: ["$avgViews", 2] },
                    engagementRate: {
                        $round: [
                            { $multiply: [
                                { $divide: ["$totalLikes", "$totalViews"] }, 
                                100
                            ] },
                            2
                        ]
                    }
                }
            },
            { $sort: { totalViews: -1 } }
        ];
        
        const results = await db.collection('news').aggregate(pipeline).toArray();
        res.json({
            success: true,
            data: results,
            period: "last_30_days"
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ENDPOINT 3: Поиск новостей (текстовый поиск + фильтры)
app.get('/api/news/search', async (req, res) => {
    try {
        const { q, category, source, page = 1, limit = 10 } = req.query;
        
        let matchStage = { "metadata.isActive": true };
        if (q) matchStage.$text = { $search: q };
        if (category) matchStage.category = category;
        if (source) matchStage["source.name"] = source;
        
        const skip = (page - 1) * limit;
        
        const pipeline = [
            { $match: matchStage },
            { $sort: { "metrics.views": -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
                $project: {
                    title: 1,
                    content: { $substr: ["$content", 0, 200] },
                    category: 1,
                    "metrics.views": 1,
                    "metrics.likes": 1,
                    "metadata.publishDate": 1,
                    "source.name": 1,
                    "author.firstName": 1,
                    "author.lastName": 1,
                    score: { $meta: "textScore" }
                }
            }
        ];
        
        const results = await db.collection('news').aggregate(pipeline).toArray();
        const total = await db.collection('news').countDocuments(matchStage);
        
        res.json({
            success: true,
            data: results,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ENDPOINT 4: Анализ авторов
app.get('/api/authors/top', async (req, res) => {
    try {
        const pipeline = [
            {
                $match: {
                    "metadata.isActive": true,
                    "metadata.publishDate": { $gte: new Date("2024-01-01") }
                }
            },
            {
                $group: {
                    _id: {
                        name: { $concat: ["$author.firstName", " ", "$author.lastName"] },
                        email: "$author.email"
                    },
                    articlesCount: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    totalLikes: { $sum: "$metrics.likes" },
                    categories: { $addToSet: "$category" },
                    lastArticleDate: { $max: "$metadata.publishDate" }
                }
            },
            {
                $project: {
                    authorName: "$_id.name",
                    email: "$_id.email",
                    articlesCount: 1,
                    totalViews: 1,
                    totalLikes: 1,
                    avgViewsPerArticle: { $round: [{ $divide: ["$totalViews", "$articlesCount"] }, 2] },
                    categoriesCovered: { $size: "$categories" },
                    lastArticleDate: 1
                }
            },
            { $match: { articlesCount: { $gte: 2 } } },
            { $sort: { totalViews: -1 } },
            { $limit: 20 }
        ];
        
        const results = await db.collection('news').aggregate(pipeline).toArray();
        res.json({
            success: true,
            data: results,
            totalAuthors: results.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ENDPOINT 5: Данные из витрины daily_stats
app.get('/api/stats/daily', async (req, res) => {
    try {
        const { date, category, limit = 20 } = req.query;
        
        let matchStage = {};
        if (date) matchStage.date = date;
        if (category) matchStage.category = category;
        
        const results = await db.collection('daily_stats')
            .find(matchStage)
            .sort({ date: -1, totalViews: -1 })
            .limit(parseInt(limit))
            .toArray();
            
        res.json({
            success: true,
            data: results,
            total: results.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const stats = await db.stats();
        res.json({ 
            success: true, 
            status: 'connected', 
            database: 'news_aggregator',
            collections: stats.collections,
            objects: stats.objects
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Корневой endpoint
app.get('/', (req, res) => {
    res.json({
        message: '📰 MongoDB News Aggregator API',
        version: '1.0.0',
        endpoints: [
            'GET /api/news/top - Top news by views',
            'GET /api/stats/categories - Category statistics',
            'GET /api/news/search - Search news (text search)',
            'GET /api/authors/top - Top authors',
            'GET /api/stats/daily - Daily stats from data mart',
            'GET /api/health - System health check'
        ]
    });
});

const PORT = 3000;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 Available endpoints:`);
        console.log(`   http://localhost:${PORT}/api/news/top`);
        console.log(`   http://localhost:${PORT}/api/stats/categories`);
        console.log(`   http://localhost:${PORT}/api/news/search`);
        console.log(`   http://localhost:${PORT}/api/authors/top`);
        console.log(`   http://localhost:${PORT}/api/stats/daily`);
        console.log(`   http://localhost:${PORT}/api/health`);
    });
});