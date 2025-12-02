// 5labscript/advanced-aggregations.js
// Комбинированные отчеты с $lookup, $unwind, $facet, $bucket, $graphLookup

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator';

class AdvancedAggregations {
    constructor() {
        this.client = null;
        this.db = null;
    }
    
    async connect() {
        this.client = new MongoClient(MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db('news_aggregator');
        console.log('✅ Подключено к MongoDB для сложных агрегаций');
    }
    
    async disconnect() {
        if (this.client) {
            await this.client.close();
        }
    }
    
    // ОТЧЕТ 1: Агрегатор новостей - распределение по источникам и темам за неделю
    async newsAggregatorReport() {
        console.log('\n📊 ОТЧЕТ 1: Агрегатор новостей');
        console.log('   Распределение новостей по источникам и темам за неделю\n');
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const pipeline = [
            // Фильтр: новости за последнюю неделю
            {
                $match: {
                    "metadata.publishDate": { $gte: oneWeekAgo },
                    "metadata.isActive": true
                }
            },
            
            // Раскрываем теги для анализа
            {
                $unwind: {
                    path: "$metadata.tags",
                    preserveNullAndEmptyArrays: false
                }
            },
            
            // Группировка по источнику и тегу
            {
                $group: {
                    _id: {
                        source: "$source.name",
                        tag: "$metadata.tags"
                    },
                    articleCount: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    totalLikes: { $sum: "$metrics.likes" },
                    avgViews: { $avg: "$metrics.views" },
                    sampleTitles: { $push: { $substr: ["$title", 0, 30] } }
                }
            },
            
            // Сортировка по популярности
            {
                $sort: { totalViews: -1 }
            },
            
            // Группировка по источникам для $facet
            {
                $group: {
                    _id: "$_id.source",
                    tags: {
                        $push: {
                            tag: "$_id.tag",
                            articleCount: "$articleCount",
                            totalViews: "$totalViews",
                            avgViews: "$avgViews"
                        }
                    },
                    sourceTotalViews: { $sum: "$totalViews" },
                    sourceTotalArticles: { $sum: "$articleCount" }
                }
            },
            
            // Используем $facet для нескольких метрик в одном запросе
            {
                $facet: {
                    // Вкладка 1: Топ тегов по источникам
                    topTagsBySource: [
                        { $unwind: "$tags" },
                        { $sort: { "tags.totalViews": -1 } },
                        { $group: {
                            _id: "$_id",
                            topTag: { $first: "$tags.tag" },
                            topTagViews: { $first: "$tags.totalViews" }
                        }},
                        { $project: {
                            source: "$_id",
                            topTag: 1,
                            topTagViews: 1,
                            _id: 0
                        }},
                        { $sort: { topTagViews: -1 } },
                        { $limit: 10 }
                    ],
                    
                    // Вкладка 2: Статистика по источникам
                    sourceStatistics: [
                        { $project: {
                            source: "$_id",
                            totalArticles: "$sourceTotalArticles",
                            totalViews: "$sourceTotalViews",
                            avgViewsPerArticle: { $round: [{ $divide: ["$sourceTotalViews", "$sourceTotalArticles"] }, 2] }
                        }},
                        { $sort: { totalViews: -1 } }
                    ],
                    
                    // Вкладка 3: Распределение тегов
                    tagDistribution: [
                        { $unwind: "$tags" },
                        { $group: {
                            _id: "$tags.tag",
                            totalArticles: { $sum: "$tags.articleCount" },
                            totalViews: { $sum: "$tags.totalViews" },
                            usedBySources: { $addToSet: "$_id" }
                        }},
                        { $project: {
                            tag: "$_id",
                            totalArticles: 1,
                            totalViews: 1,
                            sourceCount: { $size: "$usedBySources" },
                            avgViewsPerArticle: { $round: [{ $divide: ["$totalViews", "$totalArticles"] }, 2] }
                        }},
                        { $sort: { totalViews: -1 } },
                        { $limit: 15 }
                    ]
                }
            }
        ];
        
        try {
            const startTime = Date.now();
            const results = await this.db.collection('news').aggregate(pipeline).toArray();
            const endTime = Date.now();
            
            if (results.length > 0 && results[0].topTagsBySource) {
                console.log('📈 Топ тегов по источникам:');
                results[0].topTagsBySource.forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.source}: "${item.topTag}" (${item.topTagViews} просмотров)`);
                });
                
                console.log('\n📊 Статистика источников:');
                results[0].sourceStatistics.forEach((stat, index) => {
                    console.log(`   ${index + 1}. ${stat.source}: ${stat.totalArticles} статей, ${stat.totalViews} просмотров (${stat.avgViewsPerArticle} в среднем)`);
                });
                
                console.log('\n🏷️  Распределение тегов:');
                results[0].tagDistribution.slice(0, 8).forEach((tag, index) => {
                    console.log(`   ${index + 1}. ${tag.tag}: ${tag.totalArticles} статей, ${tag.totalViews} просмотров (${tag.sourceCount} источников)`);
                });
            }
            
            console.log(`\n⏱️  Время выполнения: ${endTime - startTime}ms`);
            return results;
            
        } catch (error) {
            console.error('❌ Ошибка при выполнении агрегации:', error.message);
            throw error;
        }
    }
    
    // ОТЧЕТ 2: Библиотека - рейтинг авторов + распределение по жанрам
    async authorsLibraryReport() {
        console.log('\n📚 ОТЧЕТ 2: Библиотека авторов');
        console.log('   Рейтинг авторов + распределение по жанрам\n');
        
        const pipeline = [
            // Используем $lookup для соединения с авторами
            {
                $lookup: {
                    from: "authors_stats",
                    localField: "author.name",
                    foreignField: "authorName",
                    as: "authorStats"
                }
            },
            
            // Разворачиваем authorStats
            {
                $unwind: {
                    path: "$authorStats",
                    preserveNullAndEmptyArrays: true
                }
            },
            
            // Группировка по авторам и категориям
            {
                $group: {
                    _id: {
                        author: "$author.name",
                        category: "$category"
                    },
                    articlesCount: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    totalLikes: { $sum: "$metrics.likes" },
                    authorEmail: { $first: "$author.email" },
                    authorStats: { $first: "$authorStats" }
                }
            },
            
            // Группировка по авторам для $bucket
            {
                $group: {
                    _id: "$_id.author",
                    email: { $first: "$authorEmail" },
                    categories: {
                        $push: {
                            category: "$_id.category",
                            articles: "$articlesCount",
                            views: "$totalViews",
                            likes: "$totalLikes"
                        }
                    },
                    totalArticles: { $sum: "$articlesCount" },
                    totalViews: { $sum: "$totalViews" },
                    totalLikes: { $sum: "$totalLikes" },
                    authorStats: { $first: "$authorStats" }
                }
            },
            
            // Добавляем рейтинг
            {
                $addFields: {
                    avgViewsPerArticle: { 
                        $round: [{ $divide: ["$totalViews", "$totalArticles"] }, 2] 
                    },
                    engagementRate: {
                        $round: [
                            { $multiply: [
                                { $divide: ["$totalLikes", { $max: ["$totalViews", 1] }] }, 
                                100
                            ] },
                            2
                        ]
                    },
                    // Рейтинг на основе нескольких факторов
                    ratingScore: {
                        $add: [
                            { $multiply: [{ $divide: ["$totalViews", 1000] }, 0.4] },
                            { $multiply: ["$engagementRate", 0.3] },
                            { $multiply: [{ $divide: ["$totalArticles", 10] }, 0.2] },
                            { $multiply: [
                                { $divide: [
                                    { $size: { $ifNull: ["$authorStats.categories", []] } },
                                    5
                                ] },
                                0.1
                            ]}
                        ]
                    }
                }
            },
            
            // Сортировка по рейтингу
            {
                $sort: { ratingScore: -1 }
            },
            
            // Используем $bucket для распределения по рейтингу
            {
                $bucket: {
                    groupBy: "$ratingScore",
                    boundaries: [0, 10, 20, 30, 40, 50, 100],
                    default: "above_50",
                    output: {
                        authors: { $push: {
                            name: "$_id",
                            email: "$email",
                            totalArticles: "$totalArticles",
                            totalViews: "$totalViews",
                            ratingScore: { $round: ["$ratingScore", 2] },
                            categories: "$categories"
                        }},
                        count: { $sum: 1 },
                        avgRating: { $avg: "$ratingScore" },
                        avgArticles: { $avg: "$totalArticles" }
                    }
                }
            },
            
            // Сортировка bucket
            {
                $sort: { "_id": 1 }
            }
        ];
        
        try {
            const startTime = Date.now();
            const results = await this.db.collection('news').aggregate(pipeline).toArray();
            const endTime = Date.now();
            
            console.log('🏆 Рейтинг авторов по группам:');
            
            results.forEach((bucket, index) => {
                const range = bucket._id === 'above_50' ? '50+' : `${bucket._id}-${bucket.boundaries ? bucket.boundaries[1] : '??'}`;
                console.log(`\n   Группа ${range}: ${bucket.count} авторов`);
                console.log(`   Средний рейтинг: ${bucket.avgRating.toFixed(2)}`);
                console.log(`   Среднее количество статей: ${bucket.avgArticles.toFixed(1)}`);
                
                // Показываем топ авторов в группе
                if (bucket.authors && bucket.authors.length > 0) {
                    const topAuthor = bucket.authors[0];
                    console.log(`   Лучший автор: ${topAuthor.name} (${topAuthor.totalArticles} статей, ${topAuthor.totalViews} просмотров)`);
                    
                    // Показываем распределение по категориям для топ автора
                    if (topAuthor.categories && topAuthor.categories.length > 0) {
                        console.log('   Категории:');
                        topAuthor.categories.slice(0, 3).forEach(cat => {
                            console.log(`     • ${cat.category}: ${cat.articles} статей, ${cat.views} просмотров`);
                        });
                    }
                }
            });
            
            // Дополнительно: Топ 5 авторов
            console.log('\n👑 ТОП-5 АВТОРОВ:');
            const allAuthors = results.flatMap(b => b.authors || []);
            allAuthors.sort((a, b) => b.ratingScore - a.ratingScore);
            
            allAuthors.slice(0, 5).forEach((author, index) => {
                console.log(`   ${index + 1}. ${author.name}: ${author.ratingScore} баллов, ${author.totalArticles} статей, ${author.totalViews} просмотров`);
            });
            
            console.log(`\n⏱️  Время выполнения: ${endTime - startTime}ms`);
            return results;
            
        } catch (error) {
            console.error('❌ Ошибка при выполнении агрегации:', error.message);
            throw error;
        }
    }
    
    // ОТЧЕТ 3: Магазин - топ продаж по категориям и брендам (адаптация для новостей)
    async newsStoreReport() {
        console.log('\n🏪 ОТЧЕТ 3: "Магазин" новостей');
        console.log('   Топ новостей по категориям и источникам (аналог продаж)\n');
        
        const pipeline = [
            // Основная фильтрация
            {
                $match: {
                    "metadata.isActive": true,
                    "metadata.publishDate": { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
            },
            
            // Используем $facet для параллельного выполнения нескольких агрегаций
            {
                $facet: {
                    // Вкладка 1: Общая статистика
                    overallStats: [
                        {
                            $group: {
                                _id: null,
                                totalArticles: { $sum: 1 },
                                totalViews: { $sum: "$metrics.views" },
                                totalLikes: { $sum: "$metrics.likes" },
                                avgViews: { $avg: "$metrics.views" },
                                avgEngagement: { $avg: "$metrics.engagementRate" }
                            }
                        }
                    ],
                    
                    // Вкладка 2: Топ по категориям (как "категории товаров")
                    topCategories: [
                        {
                            $group: {
                                _id: "$category",
                                articleCount: { $sum: 1 },
                                totalViews: { $sum: "$metrics.views" },
                                totalLikes: { $sum: "$metrics.likes" },
                                avgViewsPerArticle: { $avg: "$metrics.views" }
                            }
                        },
                        {
                            $project: {
                                category: "$_id",
                                articleCount: 1,
                                totalViews: 1,
                                marketShare: {
                                    $round: [
                                        { $multiply: [
                                            { $divide: ["$totalViews", { $sum: "$totalViews" }] },
                                            100
                                        ] },
                                        2
                                    ]
                                },
                                avgViewsPerArticle: { $round: ["$avgViewsPerArticle", 2] }
                            }
                        },
                        { $sort: { totalViews: -1 } },
                        { $limit: 5 }
                    ],
                    
                    // Вкладка 3: Топ по источникам (как "бренды")
                    topSources: [
                        {
                            $group: {
                                _id: "$source.name",
                                articleCount: { $sum: 1 },
                                totalViews: { $sum: "$metrics.views" },
                                totalLikes: { $sum: "$metrics.likes" },
                                countries: { $addToSet: "$source.country" }
                            }
                        },
                        {
                            $project: {
                                source: "$_id",
                                articleCount: 1,
                                totalViews: 1,
                                countriesCount: { $size: "$countries" },
                                avgViewsPerArticle: { 
                                    $round: [{ $divide: ["$totalViews", "$articleCount"] }, 2] 
                                }
                            }
                        },
                        { $sort: { totalViews: -1 } },
                        { $limit: 5 }
                    ],
                    
                    // Вкладка 4: Распределение по дням недели
                    weeklyTrends: [
                        {
                            $project: {
                                dayOfWeek: { $dayOfWeek: "$metadata.publishDate" },
                                views: "$metrics.views",
                                category: 1
                            }
                        },
                        {
                            $group: {
                                _id: "$dayOfWeek",
                                totalArticles: { $sum: 1 },
                                totalViews: { $sum: "$views" },
                                categories: { $addToSet: "$category" }
                            }
                        },
                        {
                            $project: {
                                dayOfWeek: "$_id",
                                dayName: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$_id", 1] }, then: "Воскресенье" },
                                            { case: { $eq: ["$_id", 2] }, then: "Понедельник" },
                                            { case: { $eq: ["$_id", 3] }, then: "Вторник" },
                                            { case: { $eq: ["$_id", 4] }, then: "Среда" },
                                            { case: { $eq: ["$_id", 5] }, then: "Четверг" },
                                            { case: { $eq: ["$_id", 6] }, then: "Пятница" },
                                            { case: { $eq: ["$_id", 7] }, then: "Суббота" }
                                        ],
                                        default: "Неизвестно"
                                    }
                                },
                                totalArticles: 1,
                                totalViews: 1,
                                avgViewsPerArticle: { 
                                    $round: [{ $divide: ["$totalViews", "$totalArticles"] }, 2] 
                                },
                                categoriesCount: { $size: "$categories" }
                            }
                        },
                        { $sort: { dayOfWeek: 1 } }
                    ],
                    
                    // Вкладка 5: Топ тегов (как "популярные товары")
                    trendingTags: [
                        { $unwind: "$metadata.tags" },
                        {
                            $group: {
                                _id: "$metadata.tags",
                                usageCount: { $sum: 1 },
                                totalViews: { $sum: "$metrics.views" },
                                avgViews: { $avg: "$metrics.views" },
                                categories: { $addToSet: "$category" }
                            }
                        },
                        {
                            $project: {
                                tag: "$_id",
                                usageCount: 1,
                                totalViews: 1,
                                avgViews: { $round: ["$avgViews", 2] },
                                categoriesCount: { $size: "$categories" },
                                trendScore: {
                                    $add: [
                                        { $multiply: [{ $divide: ["$usageCount", 10] }, 0.4] },
                                        { $multiply: [{ $divide: ["$totalViews", 1000] }, 0.6] }
                                    ]
                                }
                            }
                        },
                        { $sort: { trendScore: -1 } },
                        { $limit: 10 }
                    ]
                }
            }
        ];
        
        try {
            const startTime = Date.now();
            const results = await this.db.collection('news').aggregate(pipeline).toArray();
            const endTime = Date.now();
            
            if (results.length > 0) {
                const data = results[0];
                
                console.log('📈 ОБЩАЯ СТАТИСТИКА:');
                if (data.overallStats && data.overallStats.length > 0) {
                    const stats = data.overallStats[0];
                    console.log(`   Всего статей: ${stats.totalArticles}`);
                    console.log(`   Всего просмотров: ${stats.totalViews}`);
                    console.log(`   Среднее просмотров на статью: ${stats.avgViews.toFixed(2)}`);
                    console.log(`   Средняя вовлеченность: ${stats.avgEngagement ? stats.avgEngagement.toFixed(2) : 'N/A'}%`);
                }
                
                console.log('\n🏆 ТОП КАТЕГОРИЙ:');
                data.topCategories.forEach((cat, index) => {
                    console.log(`   ${index + 1}. ${cat.category}: ${cat.articleCount} статей, ${cat.totalViews} просмотров (${cat.marketShare}% доля)`);
                });
                
                console.log('\n🏢 ТОП ИСТОЧНИКОВ:');
                data.topSources.forEach((source, index) => {
                    console.log(`   ${index + 1}. ${source.source}: ${source.articleCount} статей, ${source.totalViews} просмотров (${source.avgViewsPerArticle} в среднем)`);
                });
                
                console.log('\n📅 ТРЕНДЫ ПО ДНЯМ НЕДЕЛИ:');
                data.weeklyTrends.forEach(day => {
                    console.log(`   ${day.dayName}: ${day.totalArticles} статей, ${day.totalViews} просмотров (${day.avgViewsPerArticle} в среднем)`);
                });
                
                console.log('\n🔥 ПОПУЛЯРНЫЕ ТЕГИ:');
                data.trendingTags.slice(0, 5).forEach((tag, index) => {
                    console.log(`   ${index + 1}. ${tag.tag}: используется ${tag.usageCount} раз, ${tag.totalViews} просмотров`);
                });
            }
            
            console.log(`\n⏱️  Время выполнения: ${endTime - startTime}ms`);
            return results;
            
        } catch (error) {
            console.error('❌ Ошибка при выполнении агрегации:', error.message);
            throw error;
        }
    }
    
    // ОТЧЕТ 4: Спортцентр - заполняемость залов по дням недели (адаптация для новостей)
    async newsEngagementByTimeReport() {
        console.log('\n⏰ ОТЧЕТ 4: "Спортцентр" вовлеченности');
        console.log('   Заполняемость (вовлеченность) по времени публикации\n');
        
        const pipeline = [
            // Фильтрация
            {
                $match: {
                    "metadata.isActive": true,
                    "metadata.publishDate": { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
                }
            },
            
            // Извлекаем компоненты времени
            {
                $project: {
                    hourOfDay: { $hour: "$metadata.publishDate" },
                    dayOfWeek: { $dayOfWeek: "$metadata.publishDate" },
                    month: { $month: "$metadata.publishDate" },
                    views: "$metrics.views",
                    likes: "$metrics.likes",
                    comments: "$metrics.comments",
                    category: 1,
                    title: 1
                }
            },
            
            // Группировка по часу дня
            {
                $group: {
                    _id: "$hourOfDay",
                    totalArticles: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    totalLikes: { $sum: "$likes" },
                    totalComments: { $sum: "$comments" },
                    avgViews: { $avg: "$views" },
                    sampleTitles: { $push: { $substr: ["$title", 0, 25] } }
                }
            },
            
            // Сортировка по часу
            {
                $sort: { "_id": 1 }
            },
            
            // Добавляем метрики вовлеченности
            {
                $project: {
                    hour: "$_id",
                    totalArticles: 1,
                    totalViews: 1,
                    totalLikes: 1,
                    totalComments: 1,
                    avgViews: { $round: ["$avgViews", 2] },
                    engagementRate: {
                        $round: [
                            { $multiply: [
                                { $divide: [
                                    { $add: ["$totalLikes", "$totalComments"] },
                                    { $max: ["$totalViews", 1] }
                                ] },
                                100
                            ] },
                            2
                        ]
                    },
                    // "Заполняемость" как процент от максимального значения
                    occupancyRate: {
                        $round: [
                            { $multiply: [
                                { $divide: ["$totalViews", { $max: "$totalViews" }] },
                                100
                            ] },
                            1
                        ]
                    },
                    peakHour: {
                        $cond: [
                            { $eq: ["$totalViews", { $max: "$totalViews" }] },
                            true,
                            false
                        ]
                    }
                }
            },
            
            // Используем $bucketAuto для автоматического распределения
            {
                $bucketAuto: {
                    groupBy: "$hour",
                    buckets: 6,
                    output: {
                        hours: { $push: "$$ROOT" },
                        totalArticles: { $sum: "$totalArticles" },
                        totalViews: { $sum: "$totalViews" },
                        avgOccupancy: { $avg: "$occupancyRate" }
                    }
                }
            }
        ];
        
        try {
            const startTime = Date.now();
            const results = await this.db.collection('news').aggregate(pipeline).toArray();
            const endTime = Date.now();
            
            console.log('🕐 РАСПРЕДЕЛЕНИЕ АКТИВНОСТИ ПО ЧАСАМ:');
            
            // Сначала найдем общий максимум для нормализации
            const allHours = results.flatMap(bucket => bucket.hours);
            const maxViews = Math.max(...allHours.map(h => h.totalViews));
            
            results.forEach((bucket, bucketIndex) => {
                console.log(`\n   Группа ${bucketIndex + 1}:`);
                
                // Сортируем часы в группе по просмотрам
                bucket.hours.sort((a, b) => b.totalViews - a.totalViews);
                
                bucket.hours.forEach(hour => {
                    const barLength = Math.round((hour.totalViews / maxViews) * 20);
                    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
                    
                    console.log(`     ${hour.hour.toString().padStart(2, '0')}:00 - ${bar} ${hour.totalViews} просмотров (${hour.occupancyRate}% заполняемость)`);
                    
                    if (hour.peakHour) {
                        console.log(`        ⭐ ПИКОВЫЙ ЧАС! ${hour.totalArticles} статей, вовлеченность: ${hour.engagementRate}%`);
                    }
                });
                
                console.log(`     Всего в группе: ${bucket.totalArticles} статей, ${bucket.totalViews} просмотров`);
            });
            
            // Анализ лучшего времени для публикации
            console.log('\n🎯 РЕКОМЕНДАЦИИ ПО ВРЕМЕНИ ПУБЛИКАЦИИ:');
            
            // Находим лучшие часы
            allHours.sort((a, b) => b.engagementRate - a.engagementRate);
            const bestHours = allHours.slice(0, 3);
            
            bestHours.forEach((hour, index) => {
                console.log(`   ${index + 1}. ${hour.hour}:00 - вовлеченность ${hour.engagementRate}%, ${hour.totalViews} просмотров`);
            });
            
            console.log(`\n⏱️  Время выполнения: ${endTime - startTime}ms`);
            return results;
            
        } catch (error) {
            console.error('❌ Ошибка при выполнении агрегации:', error.message);
            throw error;
        }
    }
    
    // ОТЧЕТ 5: Транспорт - среднее время опоздания по маршрутам и водителям (адаптация)
    async newsPerformanceReport() {
        console.log('\n🚌 ОТЧЕТ 5: "Транспорт" производительности');
        console.log('   Средняя производительность по категориям и авторам\n');
        
        // Создаем эталонное значение (среднее по всем новостям)
        const benchmarkPipeline = [
            {
                $match: {
                    "metadata.isActive": true,
                    "metrics.views": { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    avgViews: { $avg: "$metrics.views" },
                    avgLikes: { $avg: "$metrics.likes" },
                    avgComments: { $avg: "$metrics.comments" },
                    stdDevViews: { $stdDevPop: "$metrics.views" }
                }
            }
        ];
        
        const benchmark = await this.db.collection('news').aggregate(benchmarkPipeline).toArray();
        const benchmarkValues = benchmark[0] || { avgViews: 1000, avgLikes: 50, avgComments: 5, stdDevViews: 500 };
        
        const mainPipeline = [
            // Фильтрация
            {
                $match: {
                    "metadata.isActive": true,
                    "metrics.views": { $gt: 0 }
                }
            },
            
            // Используем $graphLookup для поиска похожих статей (по тегам)
            {
                $graphLookup: {
                    from: "news",
                    startWith: "$metadata.tags",
                    connectFromField: "metadata.tags",
                    connectToField: "metadata.tags",
                    as: "relatedArticles",
                    maxDepth: 1,
                    depthField: "depth",
                    restrictSearchWithMatch: {
                        "_id": { $ne: "$_id" },
                        "metadata.isActive": true
                    }
                }
            },
            
            // Группировка по категориям
            {
                $group: {
                    _id: "$category",
                    articlesCount: { $sum: 1 },
                    totalViews: { $sum: "$metrics.views" },
                    totalLikes: { $sum: "$metrics.likes" },
                    totalComments: { $sum: "$metrics.comments" },
                    avgViews: { $avg: "$metrics.views" },
                    avgLikes: { $avg: "$metrics.likes" },
                    // Стандартное отклонение
                    stdDevViews: { $stdDevPop: "$metrics.views" },
                    // Лучшие статьи
                    topArticles: {
                        $push: {
                            title: "$title",
                            views: "$metrics.views",
                            likes: "$metrics.likes",
                            relatedCount: { $size: "$relatedArticles" }
                        }
                    }
                }
            },
            
            // Расчет метрик производительности (аналог "опозданий")
            {
                $project: {
                    category: "$_id",
                    articlesCount: 1,
                    avgViews: { $round: ["$avgViews", 2] },
                    avgLikes: { $round: ["$avgLikes", 2] },
                    stdDevViews: { $round: ["$stdDevViews", 2] },
                    // "Опоздание" - насколько ниже среднего
                    delayScore: {
                        $round: [
                            { $multiply: [
                                { $divide: [
                                    { $subtract: [benchmarkValues.avgViews, "$avgViews"] },
                                    benchmarkValues.stdDevViews
                                ] },
                                100
                            ] },
                            2
                        ]
                    },
                    // "Надежность" - низкое стандартное отклонение хорошо
                    reliabilityScore: {
                        $round: [
                            { $multiply: [
                                { $divide: [
                                    { $subtract: [benchmarkValues.stdDevViews, "$stdDevViews"] },
                                    benchmarkValues.stdDevViews
                                ] },
                                100
                            ] },
                            2
                        ]
                    },
                    // Общая оценка
                    performanceScore: {
                        $round: [
                            { $subtract: [
                                100,
                                { $abs: "$delayScore" }
                            ] },
                            2
                        ]
                    },
                    // Топ 3 статьи
                    topArticles: {
                        $slice: [
                            {
                                $sortArray: {
                                    input: "$topArticles",
                                    sortBy: { views: -1 }
                                }
                            },
                            3
                        ]
                    }
                }
            },
            
            // Сортировка по производительности
            {
                $sort: { performanceScore: -1 }
            },
            
            // Используем $facet для разных представлений
            {
                $facet: {
                    // Представление 1: Рейтинг категорий
                    categoryRanking: [
                        { $project: {
                            category: 1,
                            articlesCount: 1,
                            avgViews: 1,
                            delayScore: 1,
                            reliabilityScore: 1,
                            performanceScore: 1,
                            status: {
                                $switch: {
                                    branches: [
                                        { case: { $gte: ["$performanceScore", 80] }, then: "Отлично" },
                                        { case: { $gte: ["$performanceScore", 60] }, then: "Хорошо" },
                                        { case: { $gte: ["$performanceScore", 40] }, then: "Удовлетворительно" },
                                        { case: { $gte: ["$performanceScore", 20] }, then: "Плохо" }
                                    ],
                                    default: "Очень плохо"
                                }
                            }
                        }}
                    ],
                    
                    // Представление 2: Анализ задержек
                    delayAnalysis: [
                        { $bucket: {
                            groupBy: "$delayScore",
                            boundaries: [-100, -50, -20, 0, 20, 50, 100],
                            default: "extreme",
                            output: {
                                categories: { $push: "$category" },
                                count: { $sum: 1 },
                                avgDelay: { $avg: "$delayScore" },
                                avgPerformance: { $avg: "$performanceScore" }
                            }
                        }},
                        { $sort: { "_id": 1 } }
                    ],
                    
                    // Представление 3: Топ статьи по категориям
                    topArticlesByCategory: [
                        { $unwind: "$topArticles" },
                        { $project: {
                            category: 1,
                            articleTitle: "$topArticles.title",
                            views: "$topArticles.views",
                            likes: "$topArticles.likes",
                            relatedArticlesCount: "$topArticles.relatedCount"
                        }},
                        { $sort: { views: -1 } },
                        { $limit: 10 }
                    ]
                }
            }
        ];
        
        try {
            const startTime = Date.now();
            const results = await this.db.collection('news').aggregate(mainPipeline).toArray();
            const endTime = Date.now();
            
            if (results.length > 0) {
                const data = results[0];
                
                console.log('📊 БЕНЧМАРК СИСТЕМЫ:');
                console.log(`   Среднее просмотров: ${benchmarkValues.avgViews.toFixed(2)}`);
                console.log(`   Стандартное отклонение: ${benchmarkValues.stdDevViews.toFixed(2)}`);
                
                console.log('\n🏆 РЕЙТИНГ КАТЕГОРИЙ:');
                data.categoryRanking.forEach((cat, index) => {
                    const delayIcon = cat.delayScore > 0 ? '⚠️ ' : '✅';
                    console.log(`   ${index + 1}. ${cat.category}: ${cat.performanceScore} баллов (${cat.status})`);
                    console.log(`      ${delayIcon} Задержка: ${cat.delayScore}%, Надежность: ${cat.reliabilityScore}%`);
                    console.log(`      ${cat.articlesCount} статей, в среднем ${cat.avgViews} просмотров`);
                });
                
                console.log('\n📉 АНАЛИЗ "ОПОЗДАНИЙ":');
                data.delayAnalysis.forEach(bucket => {
                    const range = bucket._id === 'extreme' ? 'Экстремальные' : `${bucket._id}-${bucket.boundaries ? bucket.boundaries[1] : '??'}`;
                    console.log(`   Диапазон ${range}: ${bucket.count} категорий`);
                    console.log(`      Средняя задержка: ${bucket.avgDelay.toFixed(2)}%`);
                    console.log(`      Средняя производительность: ${bucket.avgPerformance.toFixed(2)}%`);
                    console.log(`      Категории: ${bucket.categories.slice(0, 3).join(', ')}${bucket.categories.length > 3 ? '...' : ''}`);
                });
                
                console.log('\n🔥 ТОП СТАТЬИ ПО КАТЕГОРИЯМ:');
                data.topArticlesByCategory.slice(0, 5).forEach((article, index) => {
                    console.log(`   ${index + 1}. [${article.category}] ${article.articleTitle.substring(0, 30)}...`);
                    console.log(`      👁️  ${article.views} просмотров, 👍 ${article.likes} лайков`);
                    console.log(`      🔗 Связанных статей: ${article.relatedArticlesCount}`);
                });
            }
            
            console.log(`\n⏱️  Время выполнения: ${endTime - startTime}ms`);
            return results;
            
        } catch (error) {
            console.error('❌ Ошибка при выполнении агрегации:', error.message);
            throw error;
        }
    }
    
    // Основная функция для выполнения всех отчетов
    async runAllReports() {
        await this.connect();
        
        console.log('=== КОМБИНИРОВАННЫЕ ОТЧЕТЫ MONGODB AGGREGATION ===\n');
        
        try {
            // Отчет 1: Агрегатор новостей
            await this.newsAggregatorReport();
            
            // Отчет 2: Библиотека авторов
            await this.authorsLibraryReport();
            
            // Отчет 3: Магазин новостей
            await this.newsStoreReport();
            
            // Отчет 4: Спортцентр вовлеченности
            await this.newsEngagementByTimeReport();
            
            // Отчет 5: Транспорт производительности
            await this.newsPerformanceReport();
            
            console.log('\n' + '='.repeat(60));
            console.log('🎉 ВСЕ ОТЧЕТЫ УСПЕШНО СГЕНЕРИРОВАНЫ!');
            console.log('='.repeat(60));
            console.log('\nИСПОЛЬЗОВАННЫЕ ОПЕРАТОРЫ AGREGATION:');
            console.log('✅ $lookup - соединение коллекций');
            console.log('✅ $unwind - развертывание массивов');
            console.log('✅ $facet - множественные агрегации в одном запросе');
            console.log('✅ $bucket - группировка по диапазонам');
            console.log('✅ $graphLookup - рекурсивный поиск связей');
            console.log('✅ $project - преобразование данных');
            console.log('✅ $group - группировка');
            console.log('✅ $sort - сортировка');
            console.log('✅ $match - фильтрация');
            console.log('✅ $addFields - добавление полей');
            
        } catch (error) {
            console.error('❌ Ошибка при выполнении отчетов:', error.message);
        } finally {
            await this.disconnect();
        }
    }
}

// Запуск
if (require.main === module) {
    const aggregator = new AdvancedAggregations();
    
    aggregator.runAllReports().then(() => {
        console.log('\n✅ Все агрегационные отчеты выполнены!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Ошибка:', err);
        process.exit(1);
    });
}

module.exports = { AdvancedAggregations };