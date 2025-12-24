// aggregation-pipelines.js — Финальная версия: оригинал + исправления под твои данные

print("=== MONGODB AGGREGATION PIPELINES (ФИНАЛЬНАЯ ВЕРСИЯ) ===");

db = db.getSiblingDB('news_aggregator');

// PIPELINE 1: Статистика по категориям с анализом тегов — убрал жёсткий фильтр 2024
const pipeline1 = [
    {
        $match: {
            "metadata.isActive": true
            // Убрал: "metadata.publishDate": { $gte: new Date("2024-01-01") }
        }
    },
    { $unwind: "$metadata.tags" },
    {
        $group: {
            _id: { category: "$category", tag: "$metadata.tags" },
            tagUsageCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            avgViews: { $avg: "$metrics.views" },
            articles: { $push: "$title" }
        }
    },
    {
        $project: {
            _id: 0,
            category: "$_id.category",
            tag: "$_id.tag",
            tagUsageCount: 1,
            totalViews: 1,
            avgViews: { $round: ["$avgViews", 2] },
            articlesCount: { $size: "$articles" }
        }
    },
    { $sort: { tagUsageCount: -1 } },
    { $limit: 20 }
];

print("\n1. Category Tag Analysis:");
printjson(db.news.aggregate(pipeline1).toArray().slice(0, 10));

// PIPELINE 2: Анализ авторов с $lookup — исправлено имя автора
const pipeline2 = [
    { $match: { "metadata.isActive": true } },
    {
        $group: {
            _id: "$author.email",
            authorName: { $first: "$author.name" },  // Было: firstName + lastName → теперь .name
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            categories: { $addToSet: "$category" }
        }
    },
    {
        $project: {
            authorName: 1,
            articlesCount: 1,
            totalViews: 1,
            categoriesCount: { $size: "$categories" },
            avgViews: { $round: [{ $divide: ["$totalViews", "$articlesCount"] }, 2] }
        }
    },
    {
        $lookup: {
            from: "authors_stats",
            localField: "authorName",
            foreignField: "authorName",
            as: "authorStats"
        }
    },
    { $unwind: { path: "$authorStats", preserveNullAndEmptyArrays: true } },
    {
        $project: {
            authorName: 1,
            articlesCount: 1,
            totalViews: 1,
            avgViews: 1,
            categoriesCount: 1,
            engagementRate: { $ifNull: ["$authorStats.avgEngagementRate", 0] }
        }
    },
    { $sort: { totalViews: -1 } },
    { $limit: 15 }
];

print("\n2. Authors Analysis with Lookup:");
printjson(db.news.aggregate(pipeline2).toArray().slice(0, 5));

// PIPELINE 3: Ежемесячная статистика — оставляем как было, но без жёсткого 2023
const pipeline3 = [
    { $match: { "metadata.isActive": true } },
    {
        $project: {
            year: { $year: "$metadata.publishDate" },
            month: { $month: "$metadata.publishDate" },
            category: 1,
            views: "$metrics.views",
            likes: "$metrics.likes",
            shares: "$metrics.shares"
        }
    },
    {
        $group: {
            _id: { year: "$year", month: "$month", category: "$category" },
            monthlyArticles: { $sum: 1 },
            monthlyViews: { $sum: "$views" },
            monthlyLikes: { $sum: "$likes" },
            monthlyShares: { $sum: "$shares" }
        }
    },
    {
        $project: {
            period: {
                // Заменяем $lpad на конкатенацию с условным добавлением нуля
                $concat: [
                    { $toString: "$_id.year" },
                    "-",
                    {
                        $cond: {
                            if: { $lte: ["$_id.month", 9] },
                            then: { $concat: ["0", { $toString: "$_id.month" }] },
                            else: { $toString: "$_id.month" }
                        }
                    }
                ]
            },
            category: "$_id.category",
            monthlyArticles: 1,
            monthlyViews: 1,
            monthlyLikes: 1,
            monthlyShares: 1,
            engagementRate: {
                $round: [
                    { $multiply: [{ $divide: ["$monthlyLikes", { $max: ["$monthlyViews", 1] }] }, 100] },
                    2
                ]
            }
        }
    },
    { $sort: { period: -1, monthlyViews: -1 } },
    { $limit: 30 }
];

print("\n3. Monthly Trends Analysis:");
printjson(db.news.aggregate(pipeline3).toArray().slice(0, 10));

// PIPELINE 4: Анализ источников — почти оригинал
const pipeline4 = [
    { $match: { "metadata.isActive": true } },
    {
        $group: {
            _id: "$source.name",
            sourceCountry: { $first: "$source.country" },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            totalLikes: { $sum: "$metrics.likes" },
            categories: { $addToSet: "$category" }
        }
    },
    { $unwind: "$categories" },
    {
        $group: {
            _id: { source: "$_id", category: "$categories" },
            sourceCountry: { $first: "$sourceCountry" },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$totalViews" },
            totalLikes: { $sum: "$totalLikes" }
        }
    },
    {
        $project: {
            source: "$_id.source",
            country: "$sourceCountry",
            category: "$_id.category",
            articlesCount: 1,
            totalViews: 1,
            avgViews: { $round: [{ $divide: ["$totalViews", "$articlesCount"] }, 2] },
            engagementRate: { $round: [{ $multiply: [{ $divide: ["$totalLikes", "$totalViews"] }, 100] }, 3] }
        }
    },
    { $sort: { totalViews: -1 } },
    { $limit: 25 }
];

print("\n4. News Sources Analysis:");
printjson(db.news.aggregate(pipeline4).toArray().slice(0, 10));

// PIPELINE 5: Комментарии — через $lookup по commentIds
const pipeline5 = [
    { $match: { commentIds: { $exists: true, $ne: [] } } },
    { $lookup: { from: "comments", localField: "commentIds", foreignField: "_id", as: "comments" } },
    { $unwind: "$comments" },
    {
        $group: {
            _id: "$title",
            category: { $first: "$category" },
            totalComments: { $sum: 1 },
            totalCommentLikes: { $sum: "$comments.likes" },
            uniqueCommenters: { $addToSet: "$comments.user" }
        }
    },
    {
        $project: {
            title: "$_id",
            category: 1,
            totalComments: 1,
            totalCommentLikes: 1,
            uniqueCommenters: { $size: "$uniqueCommenters" },
            avgLikesPerComment: { $round: [{ $divide: ["$totalCommentLikes", "$totalComments"] }, 2] }
        }
    },
    { $sort: { totalCommentLikes: -1 } },
    { $limit: 15 }
];

print("\n5. Comments Engagement Analysis:");
printjson(db.news.aggregate(pipeline5).toArray().slice(0, 10));

// PIPELINE 6: Комбинированный многоуровневый отчёт — распределение по источникам и темам за неделю
const pipeline6 = [
    {
        $match: {
            "metadata.isActive": true,
            "metadata.publishDate": {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)  // За последнюю неделю
            }
        }
    },
    {
        $facet: {
            // 1. Обзор по источникам (по алфавиту)
            "sourcesOverview": [
                {
                    $group: {
                        _id: "$source.name",
                        country: { $first: "$source.country" },
                        articlesCount: { $sum: 1 },
                        totalViews: { $sum: "$metrics.views" }
                    }
                },
                {
                    $project: {
                        source: "$_id",
                        country: 1,
                        articlesCount: 1,
                        totalViews: 1,
                        avgViews: { $round: [{ $divide: ["$totalViews", { $max: ["$articlesCount", 1] }] }, 0] }
                    }
                },
                { $sort: { source: 1 } }  // По алфавиту по источнику
            ],

            // 2. Обзор по темам/категориям (по алфавиту)
            "categoriesOverview": [
                {
                    $group: {
                        _id: "$category",
                        articlesCount: { $sum: 1 },
                        totalViews: { $sum: "$metrics.views" }
                    }
                },
                {
                    $project: {
                        category: "$_id",
                        articlesCount: 1,
                        totalViews: 1,
                        avgViews: { $round: [{ $divide: ["$totalViews", { $max: ["$articlesCount", 1] }] }, 0] }
                    }
                },
                { $sort: { category: 1 } }  // По алфавиту по категории
            ],

            // 3. Пересечение: источник × тема — группировка логичная (сначала источник, потом темы внутри)
            "sourcesByCategory": [
                {
                    $group: {
                        _id: { source: "$source.name", category: "$category" },
                        articlesCount: { $sum: 1 },
                        totalViews: { $sum: "$metrics.views" }
                    }
                },
                {
                    $project: {
                        source: "$_id.source",
                        category: "$_id.category",
                        articlesCount: 1,
                        totalViews: 1,
                        avgViews: { $round: [{ $divide: ["$totalViews", { $max: ["$articlesCount", 1] }] }, 0] }
                    }
                },
                { $sort: { category: 1 } },  // Сначала по источнику, потом по категории — всё рядом!
                { $limit: 30 }
            ],

            // 4. Распределение по просмотрам (бакеты)
            "viewsBuckets": [
                {
                    $bucket: {
                        groupBy: "$metrics.views",
                        boundaries: [0, 5000, 10000, 20000, 30000, 50000, 100000],
                        default: "100k+",
                        output: {
                            articlesCount: { $sum: 1 }
                        }
                    }
                }
            ]
        }
    },
    // Добавляем общее количество статей за неделю
    {
        $project: {
            sourcesOverview: 1,
            categoriesOverview: 1,
            sourcesByCategory: 1,
            viewsBuckets: 1,
            totalArticlesInWeek: { $sum: "$sourcesOverview.articlesCount" }
        }
    }
];

print("\n6. Комбинированный многоуровневый отчёт: Распределение новостей по источникам и темам за последнюю неделю");
print("   (используется $facet для параллельных подотчётов + $bucket)\n");
printjson(db.news.aggregate(pipeline6).toArray());