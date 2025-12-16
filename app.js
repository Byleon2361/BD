// app.js - ПОЛНАЯ ВЕРСИЯ С MONGODB И POSTGRESQL
const express = require('express');
const {MongoClient} = require('mongodb');
const {Pool} = require('pg'); // Добавляем PostgreSQL
const app = express();
app.use(express.json());

// ===================== КОНФИГУРАЦИЯ =====================

// MongoDB подключение
const MONGODB_URI =
    'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';
let mongoDb;

// PostgreSQL подключение
const pgPool = new Pool({
    user : 'postgres',
    host : 'localhost',
    database : 'news_aggregator',
    password : 'password',
    port : 5432,
    max : 20,
    idleTimeoutMillis : 30000,
    connectionTimeoutMillis : 2000,
});

// ===================== ПОДКЛЮЧЕНИЯ =====================

// Подключение к MongoDB
async function connectMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        mongoDb = client.db('news_aggregator');
        console.log('✅ Connected to MongoDB successfully');

        const collections = await mongoDb.listCollections().toArray();
        console.log(`📁 MongoDB collections: ${
            collections.map(c => c.name).join(', ')}`);

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
}

// Подключение к PostgreSQL
async function connectPostgreSQL() {
    try {
        const client = await pgPool.connect();
        console.log('✅ Connected to PostgreSQL successfully');

        // Проверяем основные таблицы
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        console.log(`🗃️ PostgreSQL tables: ${
            result.rows.map(r => r.table_name).join(', ')}`);

        client.release();
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
    }
}

// ===================== СУЩЕСТВУЮЩИЕ MONGODB ЭНДПОИНТЫ =====================
// (без изменений)

// ENDPOINT 1: Получить топ новостей по просмотрам
app.get('/api/news/top', async (req, res) => {
    try {
        const {category, limit = 10} = req.query;

        let matchStage = {"metadata.isActive" : true};
        if (category)
            matchStage.category = category;

        const pipeline = [
            {$match : matchStage}, {$sort : {"metrics.views" : -1}},
            {$limit : parseInt(limit)}, {
                $project : {
                    title : 1,
                    category : 1,
                    "metrics.views" : 1,
                    "metrics.likes" : 1,
                    "metadata.publishDate" : 1,
                    "source.name" : 1,
                    "author.firstName" : 1,
                    "author.lastName" : 1
                }
            }
        ];

        const results =
            await mongoDb.collection('news').aggregate(pipeline).toArray();
        res.json({
            success : true,
            data : results,
            total : results.length,
            source : 'MongoDB'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// ENDPOINT 2: Статистика по категориям
app.get('/api/stats/categories', async (req, res) => {
    try {
        const pipeline = [
            {
                $match : {
                    "metadata.isActive" : true,
                    "metadata.publishDate" :
                        {$gte : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
                }
            },
            {
                $group : {
                    _id : "$category",
                    totalArticles : {$sum : 1},
                    totalViews : {$sum : "$metrics.views"},
                    totalLikes : {$sum : "$metrics.likes"},
                    avgViews : {$avg : "$metrics.views"}
                }
            },
            {
                $project : {
                    category : "$_id",
                    totalArticles : 1,
                    totalViews : 1,
                    totalLikes : 1,
                    avgViews : {$round : [ "$avgViews", 2 ]},
                    engagementRate : {
                        $round : [
                            {
                                $multiply : [
                                    {
                                        $divide :
                                            [ "$totalLikes", "$totalViews" ]
                                    },
                                    100
                                ]
                            },
                            2
                        ]
                    }
                }
            },
            {$sort : {totalViews : -1}}
        ];

        const results =
            await mongoDb.collection('news').aggregate(pipeline).toArray();
        res.json({
            success : true,
            data : results,
            period : "last_30_days",
            source : 'MongoDB'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// ENDPOINT 3: Поиск новостей (текстовый поиск + фильтры)
app.get('/api/news/search', async (req, res) => {
    try {
        const {q, category, source, page = 1, limit = 10} = req.query;

        let matchStage = {"metadata.isActive" : true};
        if (q)
            matchStage.$text = {$search : q};
        if (category)
            matchStage.category = category;
        if (source)
            matchStage["source.name"] = source;

        const skip = (page - 1) * limit;

        const pipeline = [
            {$match : matchStage}, {$sort : {"metrics.views" : -1}},
            {$skip : skip}, {$limit : parseInt(limit)}, {
                $project : {
                    title : 1,
                    content : {$substr : [ "$content", 0, 200 ]},
                    category : 1,
                    "metrics.views" : 1,
                    "metrics.likes" : 1,
                    "metadata.publishDate" : 1,
                    "source.name" : 1,
                    "author.firstName" : 1,
                    "author.lastName" : 1,
                    score : {$meta : "textScore"}
                }
            }
        ];

        const results =
            await mongoDb.collection('news').aggregate(pipeline).toArray();
        const total =
            await mongoDb.collection('news').countDocuments(matchStage);

        res.json({
            success : true,
            data : results,
            pagination : {
                page : parseInt(page),
                limit : parseInt(limit),
                total,
                pages : Math.ceil(total / limit)
            },
            source : 'MongoDB'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// ENDPOINT 4: Анализ авторов
app.get('/api/authors/top', async (req, res) => {
    try {
        const pipeline = [
            {
                $match : {
                    "metadata.isActive" : true,
                    "metadata.publishDate" : {$gte : new Date("2024-01-01")}
                }
            },
            {
                $group : {
                    _id : {
                        name : {
                            $concat :
                                [ "$author.firstName", " ", "$author.lastName" ]
                        },
                        email : "$author.email"
                    },
                    articlesCount : {$sum : 1},
                    totalViews : {$sum : "$metrics.views"},
                    totalLikes : {$sum : "$metrics.likes"},
                    categories : {$addToSet : "$category"},
                    lastArticleDate : {$max : "$metadata.publishDate"}
                }
            },
            {
                $project : {
                    authorName : "$_id.name",
                    email : "$_id.email",
                    articlesCount : 1,
                    totalViews : 1,
                    totalLikes : 1,
                    avgViewsPerArticle : {
                        $round : [
                            {$divide : [ "$totalViews", "$articlesCount" ]}, 2
                        ]
                    },
                    categoriesCovered : {$size : "$categories"},
                    lastArticleDate : 1
                }
            },
            {$match : {articlesCount : {$gte : 2}}},
            {$sort : {totalViews : -1}}, {$limit : 20}
        ];

        const results =
            await mongoDb.collection('news').aggregate(pipeline).toArray();
        res.json({
            success : true,
            data : results,
            totalAuthors : results.length,
            source : 'MongoDB'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// ENDPOINT 5: Данные из витрины daily_stats
app.get('/api/stats/daily', async (req, res) => {
    try {
        const {date, category, limit = 20} = req.query;

        let matchStage = {};
        if (date)
            matchStage.date = date;
        if (category)
            matchStage.category = category;

        const results = await mongoDb.collection('daily_stats')
                            .find(matchStage)
                            .sort({date : -1, totalViews : -1})
                            .limit(parseInt(limit))
                            .toArray();

        res.json({
            success : true,
            data : results,
            total : results.length,
            source : 'MongoDB'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// Health check endpoint MongoDB
app.get('/api/health/mongo', async (req, res) => {
    try {
        const stats = await mongoDb.stats();
        res.json({
            success : true,
            status : 'connected',
            database : 'news_aggregator',
            collections : stats.collections,
            objects : stats.objects,
            source : 'MongoDB'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// ===================== НОВЫЕ POSTGRESQL ЭНДПОИНТЫ =====================

// POSTGRESQL ЭНДПОИНТ 1: Топ-10 самых популярных новостей
app.get('/api/pg/news/top', async (req, res) => {
    try {
        const query = `
            SELECT 
                title,
                views_count,
                likes_count,
                publish_date,
                (SELECT name FROM categories WHERE id = news.category_id) as category_name
            FROM news
            WHERE is_active = TRUE
            ORDER BY views_count DESC
            LIMIT 10
        `;

        const result = await pgPool.query(query);
        res.json({
            success : true,
            data : result.rows,
            total : result.rowCount,
            source : 'PostgreSQL'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// POSTGRESQL ЭНДПОИНТ 2: Статистика по авторам
app.get('/api/pg/authors/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.first_name || ' ' || a.last_name as author_name,
                COUNT(n.id) as articles_count,
                SUM(n.views_count) as total_views,
                ROUND(AVG(n.views_count), 2) as avg_views,
                SUM(n.likes_count) as total_likes
            FROM authors a
            JOIN news n ON a.id = n.author_id
            GROUP BY a.id, author_name
            HAVING COUNT(n.id) > 0
            ORDER BY total_views DESC
            LIMIT 15
        `;

        const result = await pgPool.query(query);
        res.json({
            success : true,
            data : result.rows,
            total : result.rowCount,
            source : 'PostgreSQL'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// POSTGRESQL ЭНДПОИНТ 3: Новости с категориями и источниками (3 таблицы)
app.get('/api/pg/news/detailed', async (req, res) => {
    try {
        const {limit = 15} = req.query;

        const query = `
            SELECT n.title, c.name as category, s.name as source, n.publish_date
            FROM news n
            JOIN categories c ON n.category_id = c.id
            JOIN sources s ON n.source_id = s.id
            WHERE n.is_active = TRUE
            ORDER BY n.publish_date DESC
            LIMIT $1
        `;

        const result = await pgPool.query(query, [ limit ]);
        res.json({
            success : true,
            data : result.rows,
            total : result.rowCount,
            source : 'PostgreSQL'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// POSTGRESQL ЭНДПОИНТ 4: Еженедельная статистика публикаций
app.get('/api/pg/stats/weekly', async (req, res) => {
    try {
        const {months = 3} = req.query;

        const query = `
            SELECT 
                EXTRACT(YEAR FROM publish_date) as year,
                EXTRACT(WEEK FROM publish_date) as week,
                COUNT(*) as articles_count,
                SUM(views_count) as weekly_views,
                ROUND(AVG(views_count), 2) as avg_views_per_article
            FROM news
            WHERE publish_date >= CURRENT_DATE - INTERVAL '${months} months'
            GROUP BY year, week
            ORDER BY year DESC, week DESC
        `;

        const result = await pgPool.query(query);
        res.json({
            success : true,
            data : result.rows,
            total : result.rowCount,
            source : 'PostgreSQL',
            period : `${months} months`
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// POSTGRESQL ЭНДПОИНТ 5: Комплексный отчет (5 таблиц)
app.get('/api/pg/news/comprehensive', async (req, res) => {
    try {
        const {days = 30, limit = 10} = req.query;

        const query = `
            SELECT 
                n.title, 
                n.publish_date, 
                n.views_count, 
                n.likes_count,
                c.name as category,
                s.name as source,
                a.first_name || ' ' || a.last_name as author,
                COALESCE(STRING_AGG(DISTINCT t.name, ', '), 'No tags') as tags,
                COUNT(cm.id) as comments_count
            FROM news n
            JOIN categories c ON n.category_id = c.id
            JOIN sources s ON n.source_id = s.id
            JOIN authors a ON n.author_id = a.id
            LEFT JOIN news_tags nt ON n.id = nt.news_id
            LEFT JOIN tags t ON nt.tag_id = t.id
            LEFT JOIN comments cm ON n.id = cm.news_id
            WHERE n.publish_date >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY n.id, n.title, n.publish_date, n.views_count, n.likes_count,
                     c.name, s.name, a.first_name, a.last_name
            ORDER BY n.views_count DESC
            LIMIT $1
        `;

        const result = await pgPool.query(query, [ limit ]);
        res.json({
            success : true,
            data : result.rows,
            total : result.rowCount,
            source : 'PostgreSQL',
            period : `${days} days`
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// POSTGRESQL ЭНДПОИНТ 6: Активность по категориям
app.get('/api/pg/stats/categories', async (req, res) => {
    try {
        const {months = 1} = req.query;

        const query = `
            SELECT 
                c.name as category_name,
                COUNT(n.id) as articles_count,
                COALESCE(SUM(n.views_count), 0) as total_views,
                ROUND(COALESCE(AVG(n.views_count), 0), 2) as avg_views
            FROM categories c
            LEFT JOIN news n ON c.id = n.category_id 
                AND n.publish_date >= CURRENT_DATE - INTERVAL '${months} month'
            GROUP BY c.id, c.name
            ORDER BY articles_count DESC, total_views DESC
        `;

        const result = await pgPool.query(query);
        res.json({
            success : true,
            data : result.rows,
            total : result.rowCount,
            source : 'PostgreSQL',
            period : `${months} month(s)`
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// Health check endpoint PostgreSQL
app.get('/api/health/postgres', async (req, res) => {
    try {
        const result =
            await pgPool.query('SELECT version(), current_database()');
        const tableCount = await pgPool.query(`
            SELECT COUNT(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        res.json({
            success : true,
            status : 'connected',
            version : result.rows[0].version,
            database : result.rows[0].current_database,
            tables : tableCount.rows[0].table_count,
            source : 'PostgreSQL'
        });
    } catch (error) {
        res.status(500).json({success : false, error : error.message});
    }
});

// ===================== УНИВЕРСАЛЬНЫЕ ЭНДПОИНТЫ =====================

// Общий health check для обеих баз
app.get('/api/health', async (req, res) => {
    try {
        const mongoStats = await mongoDb.stats();
        const pgResult =
            await pgPool.query('SELECT version(), current_database()');
        const pgTableCount = await pgPool.query(`
            SELECT COUNT(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        res.json({
            success : true,
            timestamp : new Date().toISOString(),
            mongo : {
                status : 'connected',
                database : 'news_aggregator',
                collections : mongoStats.collections,
                objects : mongoStats.objects
            },
            postgres : {
                status : 'connected',
                version : pgResult.rows[0].version,
                database : pgResult.rows[0].current_database,
                tables : pgTableCount.rows[0].table_count
            },
            endpoints : {
                mongo : [
                    '/api/news/top', '/api/stats/categories',
                    '/api/news/search', '/api/authors/top', '/api/stats/daily'
                ],
                postgres : [
                    '/api/pg/news/top', '/api/pg/authors/stats',
                    '/api/pg/news/detailed', '/api/pg/stats/weekly',
                    '/api/pg/news/comprehensive'
                ]
            }
        });
    } catch (error) {
        res.status(500).json({
            success : false,
            error : error.message,
            timestamp : new Date().toISOString()
        });
    }
});

// Корневой endpoint
app.get('/', (req, res) => {
    res.json({
        message : '📰 News Aggregator API (MongoDB + PostgreSQL)',
        version : '2.0.0',
        databases : [ 'MongoDB', 'PostgreSQL' ],
        mongo_endpoints : [
            'GET /api/news/top - Top news by views (MongoDB)',
            'GET /api/stats/categories - Category statistics (MongoDB)',
            'GET /api/news/search - Search news (text search) (MongoDB)',
            'GET /api/authors/top - Top authors (MongoDB)',
            'GET /api/stats/daily - Daily stats from data mart (MongoDB)',
            'GET /api/health/mongo - MongoDB health check'
        ],
        postgres_endpoints : [
            'GET /api/pg/news/top - Top-10 popular news (PostgreSQL)',
            'GET /api/pg/authors/stats - Author statistics (PostgreSQL)',
            'GET /api/pg/news/detailed - News with categories & sources (PostgreSQL)',
            'GET /api/pg/stats/weekly - Weekly publication stats (PostgreSQL)',
            'GET /api/pg/news/comprehensive - Comprehensive 5-table report (PostgreSQL)',
            'GET /api/pg/stats/categories - Category activity (PostgreSQL)',
            'GET /api/health/postgres - PostgreSQL health check'
        ],
        universal_endpoints : [
            'GET /api/health - Combined health check for both databases',
            'GET / - This documentation'
        ],
        note :
            'All MongoDB endpoints preserved. PostgreSQL endpoints have /pg/ prefix.'
    });
});

// ===================== ЗАПУСК СЕРВЕРА =====================

const PORT = 3000;

async function startServer() {
    console.log('🚀 Starting News Aggregator API...');

    try {
        await connectMongoDB();
        await connectPostgreSQL();

        app.listen(PORT, () => {
            console.log(`\n✅ Server running on http://localhost:${PORT}`);
            console.log('\n📊 MONGODB ENDPOINTS:');
            console.log('   http://localhost:3000/api/news/top');
            console.log('   http://localhost:3000/api/stats/categories');
            console.log('   http://localhost:3000/api/news/search');
            console.log('   http://localhost:3000/api/authors/top');
            console.log('   http://localhost:3000/api/stats/daily');

            console.log('\n🗃️ POSTGRESQL ENDPOINTS:');
            console.log('   http://localhost:3000/api/pg/news/top');
            console.log('   http://localhost:3000/api/pg/authors/stats');
            console.log('   http://localhost:3000/api/pg/news/detailed');
            console.log('   http://localhost:3000/api/pg/stats/weekly');
            console.log('   http://localhost:3000/api/pg/news/comprehensive');

            console.log('\n📈 HEALTH CHECKS:');
            console.log('   http://localhost:3000/api/health/mongo');
            console.log('   http://localhost:3000/api/health/postgres');
            console.log('   http://localhost:3000/api/health');
            console.log('\n📖 DOCUMENTATION:');
            console.log('   http://localhost:3000/');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();