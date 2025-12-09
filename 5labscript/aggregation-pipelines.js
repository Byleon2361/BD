// aggregation-pipelines.js

print("=== MONGODB AGGREGATION PIPELINES ===");

// PIPELINE 1: Статистика по категориям с анализом тегов
const pipeline1 = [
    // $match - фильтрация документов
    {
        $match: {
            "metadata.isActive": true,
            "metadata.publishDate": { $gte: new Date("2024-01-01") }
        }
    },
    // $unwind - разворачиваем массив тегов
    {
        $unwind: "$metadata.tags"
    },
    // $group - группировка по категориям и тегам
    {
        $group: {
            _id: {
                category: "$category",
                tag: "$metadata.tags"
            },
            tagUsageCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            avgViews: { $avg: "$metrics.views" },
            articles: { $push: "$title" }
        }
    },
    // $project - преобразование результатов
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
    // $sort - сортировка по использованию тегов
    {
        $sort: { tagUsageCount: -1 }
    },
    // $limit - ограничение результатов
    {
        $limit: 20
    }
];

print("\n1. Category Tag Analysis:");
const result1 = db.news.aggregate(pipeline1).toArray();
printjson(result1.slice(0, 5));

// PIPELINE 2: Анализ авторов с $lookup (связь 1 -> N)
const pipeline2 = [
    // $match - активные статьи
    {
        $match: {
            "metadata.isActive": true
        }
    },
    // $group - группировка по авторам
    {
        $group: {
            _id: "$author.email",
            authorName: { 
                $first: { 
                    $concat: ["$author.firstName", " ", "$author.lastName"] 
                } 
            },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            categories: { $addToSet: "$category" },
            articleTitles: { $push: "$title" }
        }
    },
    // $project - подготовка данных для lookup
    {
        $project: {
            authorName: 1,
            articlesCount: 1,
            totalViews: 1,
            categoriesCount: { $size: "$categories" },
            avgViews: { $round: [{ $divide: ["$totalViews", "$articlesCount"] }, 2] }
        }
    },
    // $lookup - соединение с коллекцией authors_stats
    {
        $lookup: {
            from: "authors_stats",
            localField: "authorName",
            foreignField: "authorName",
            as: "authorStats"
        }
    },
    // $unwind - разворачиваем результат lookup
    {
        $unwind: {
            path: "$authorStats",
            preserveNullAndEmptyArrays: true
        }
    },
    // $project - финальная форма
    {
        $project: {
            authorName: 1,
            articlesCount: 1,
            totalViews: 1,
            avgViews: 1,
            categoriesCount: 1,
            engagementRate: {
                $ifNull: [
                    "$authorStats.engagementRate", 
                    { $round: [{ $multiply: [
                        { $divide: ["$totalViews", "$articlesCount"] }, 
                        0.1
                    ]}, 2] }
                ]
            }
        }
    },
    // $sort - по количеству просмотров
    {
        $sort: { totalViews: -1 }
    },
    // $limit - топ авторов
    {
        $limit: 15
    }
];

print("\n2. Authors Analysis with Lookup:");
const result2 = db.news.aggregate(pipeline2).toArray();
printjson(result2.slice(0, 5));

// PIPELINE 3: Ежемесячная статистика с анализом трендов
const pipeline3 = [
    // $match - фильтрация по дате
    {
        $match: {
            "metadata.isActive": true,
            "metadata.publishDate": { $gte: new Date("2023-01-01") }
        }
    },
    // $project - подготовка временных меток
    {
        $project: {
            year: { $year: "$metadata.publishDate" },
            month: { $month: "$metadata.publishDate" },
            category: 1,
            views: "$metrics.views",
            likes: "$metrics.likes",
            shares: "$metrics.shares",
            readingTime: "$metrics.reading_time"
        }
    },
    // $group - группировка по месяцам и категориям
    {
        $group: {
            _id: {
                year: "$year",
                month: "$month",
                category: "$category"
            },
            monthlyArticles: { $sum: 1 },
            monthlyViews: { $sum: "$views" },
            monthlyLikes: { $sum: "$likes" },
            monthlyShares: { $sum: "$shares" },
            avgReadingTime: { $avg: "$readingTime" }
        }
    },
    // $project - расчет метрик
    {
        $project: {
            period: {
                $concat: [
                    { $toString: "$_id.year" }, "-",
                    { $toString: "$_id.month" }
                ]
            },
            category: "$_id.category",
            monthlyArticles: 1,
            monthlyViews: 1,
            monthlyLikes: 1,
            monthlyShares: 1,
            avgReadingTime: { $round: ["$avgReadingTime", 2] },
            engagementRate: {
                $round: [
                    { $multiply: [
                        { $divide: ["$monthlyLikes", "$monthlyViews"] }, 
                        100
                    ] },
                    2
                ]
            }
        }
    },
    // $sort - сортировка по периоду и просмотрам
    {
        $sort: { period: -1, monthlyViews: -1 }
    },
    // $limit - последние периоды
    {
        $limit: 30
    }
];

print("\n3. Monthly Trends Analysis:");
const result3 = db.news.aggregate(pipeline3).toArray();
printjson(result3.slice(0, 5));

// PIPELINE 4: Анализ источников новостей
const pipeline4 = [
    // $match - активные статьи
    {
        $match: {
            "metadata.isActive": true
        }
    },
    // $group - по источникам
    {
        $group: {
            _id: "$source.name",
            sourceCountry: { $first: "$source.country" },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$metrics.views" },
            totalLikes: { $sum: "$metrics.likes" },
            categories: { $addToSet: "$category" },
            avgViews: { $avg: "$metrics.views" }
        }
    },
    // $unwind - для анализа по категориям
    {
        $unwind: "$categories"
    },
    // $group - детализация по источникам и категориям
    {
        $group: {
            _id: {
                source: "$_id",
                category: "$categories"
            },
            sourceCountry: { $first: "$sourceCountry" },
            articlesCount: { $sum: 1 },
            totalViews: { $sum: "$totalViews" },
            totalLikes: { $sum: "$totalLikes" }
        }
    },
    // $project - финальные расчеты
    {
        $project: {
            _id: 0,
            source: "$_id.source",
            country: "$sourceCountry",
            category: "$_id.category",
            articlesCount: 1,
            totalViews: 1,
            avgViews: { $round: [{ $divide: ["$totalViews", "$articlesCount"] }, 2] },
            engagementRate: {
                $round: [
                    { $multiply: [
                        { $divide: ["$totalLikes", "$totalViews"] }, 
                        100
                    ] },
                    3
                ]
            }
        }
    },
    // $sort - сортировка
    {
        $sort: { totalViews: -1 }
    },
    // $limit - ограничение
    {
        $limit: 25
    }
];

print("\n4. News Sources Analysis:");
const result4 = db.news.aggregate(pipeline4).toArray();
printjson(result4.slice(0, 5));

// PIPELINE 5: Анализ комментариев и вовлеченности
const pipeline5 = [
    // $match - статьи с комментариями
    {
        $match: {
            "metadata.isActive": true,
            "metrics.comments_count": { $gt: 0 }
        }
    },
    // $unwind - разворачиваем комментарии
    {
        $unwind: "$comments"
    },
    // $match - только approved комментарии
    {
        $match: {
            "comments.is_approved": true
        }
    },
    // $group - анализ по статьям
    {
        $group: {
            _id: "$_id",
            title: { $first: "$title" },
            category: { $first: "$category" },
            totalComments: { $sum: 1 },
            totalCommentLikes: { $sum: "$comments.likes" },
            avgCommentLength: { $avg: { $strLenCP: "$comments.content" } },
            uniqueCommenters: { $addToSet: "$comments.user_name" }
        }
    },
    // $project - расчет метрик
    {
        $project: {
            title: 1,
            category: 1,
            totalComments: 1,
            totalCommentLikes: 1,
            avgCommentLength: { $round: ["$avgCommentLength", 2] },
            uniqueCommenters: { $size: "$uniqueCommenters" },
            avgLikesPerComment: { 
                $round: [{ $divide: ["$totalCommentLikes", "$totalComments"] }, 2] 
            }
        }
    },
    // $sort - по вовлеченности
    {
        $sort: { totalCommentLikes: -1 }
    },
    // $limit - топ статей
    {
        $limit: 15
    }
];


print("\n5. Comments Engagement Analysis:");
const result5 = db.news.aggregate(pipeline5).toArray();
printjson(result5.slice(0, 5));
// PIPELINE 6: Multi-level report with $facet and $bucket
const pipeline6 = [
    { $match: { "metadata.publishDate": { $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) } } },  // За неделю
    { $facet: {
        bySource: [
            { $group: { _id: "$source.name", count: { $sum: 1 }, totalViews: { $sum: "$metrics.views" } } },
            { $sort: { totalViews: -1 } }
        ],
        byTheme: [
            { $unwind: "$metadata.tags" },
            { $group: { _id: "$metadata.tags", count: { $sum: 1 }, avgViews: { $avg: "$metrics.views" } } },
            { $sort: { count: -1 } }
        ],
        viewsBuckets: [
            { $bucket: {
                groupBy: "$metrics.views",
                boundaries: [0, 100, 1000, 10000, Infinity],
                default: "Other",
                output: { count: { $sum: 1 } }
            } }
        ]
    } }
];

print("\n6. Weekly News Distribution Report (by sources, themes, views buckets):");
const result6 = db.news.aggregate(pipeline6).toArray();
printjson(result6);